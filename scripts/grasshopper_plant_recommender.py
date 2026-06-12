from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "BUILDING_ORIENTATION",
    "RATIO_N",
    "RATIO_E",
    "RATIO_S",
    "RATIO_W",
    "UDI",
    "SUN_HOURS",
    "RADIATION",
]

BRIDGE_KEY_COLS = [
    "sun_min_h_day",
    "sun_max_h_day",
    "lux_min",
    "lux_max",
    "sun_center_h_day",
    "lux_center",
    "plant_light_index",
]


@dataclass
class RecommendationArtifacts:
    model: Any
    plants: pd.DataFrame
    cluster_profiles: pd.DataFrame
    reference_predictions: pd.DataFrame


def load_artifacts(root: str | Path) -> RecommendationArtifacts:
    root = Path(root)
    processed_dir = root / "data" / "processed"
    model_path = root / "models" / "plant_cluster_classifier.joblib"

    model = joblib.load(model_path)
    plants = pd.read_csv(processed_dir / "plants_encoded.csv")
    cluster_profiles = pd.read_csv(processed_dir / "plants_cluster_profiles.csv")
    reference_predictions = pd.read_csv(processed_dir / "geometry_predictions.csv")

    if not {"bridge_cluster_id", "bridge_cluster_label"}.issubset(plants.columns):
        if {"bridge_cluster_id", "bridge_cluster_label"}.issubset(cluster_profiles.columns):
            bridge_map = cluster_profiles[
                ["plant_variety_cluster", "bridge_cluster_id", "bridge_cluster_label"]
            ].drop_duplicates()
        else:
            bridge_profiles = cluster_profiles[BRIDGE_KEY_COLS].drop_duplicates().reset_index(drop=True).copy()
            bridge_profiles["bridge_cluster_id"] = bridge_profiles.index.astype(int)
            bridge_profiles["bridge_cluster_label"] = (
                "bridge_cluster_" + bridge_profiles["bridge_cluster_id"].astype(str)
            )
            bridge_map = (
                cluster_profiles[["plant_variety_cluster"] + BRIDGE_KEY_COLS]
                .merge(bridge_profiles, on=BRIDGE_KEY_COLS, how="left")
                [["plant_variety_cluster", "bridge_cluster_id", "bridge_cluster_label"]]
                .drop_duplicates()
            )
        plants = plants.merge(bridge_map, on="plant_variety_cluster", how="left")

    return RecommendationArtifacts(
        model=model,
        plants=plants,
        cluster_profiles=cluster_profiles,
        reference_predictions=reference_predictions,
    )


def minmax_against_reference(value: float, reference_series: pd.Series) -> float:
    min_val = float(reference_series.min())
    max_val = float(reference_series.max())
    if max_val == min_val:
        return 0.0
    return (float(value) - min_val) / (max_val - min_val)


def prepare_tile(tile: Dict[str, float], reference_predictions: pd.DataFrame) -> pd.DataFrame:
    row = dict(tile)
    row["sun_h_day_estimated"] = row["SUN_HOURS"] / 365.0 if row["SUN_HOURS"] > 24 else row["SUN_HOURS"]
    row["sun_norm"] = minmax_against_reference(row["SUN_HOURS"], reference_predictions["SUN_HOURS"])
    row["radiation_norm"] = minmax_against_reference(row["RADIATION"], reference_predictions["RADIATION"])
    row["udi_norm"] = minmax_against_reference(row["UDI"], reference_predictions["UDI"])
    row["tile_light_index"] = 0.45 * row["sun_norm"] + 0.45 * row["radiation_norm"] + 0.10 * row["udi_norm"]
    return pd.DataFrame([{col: row[col] for col in FEATURE_COLUMNS + ["sun_h_day_estimated", "tile_light_index"]}])


def _extract_cluster_id_from_model_label(label: str) -> int:
    if label.startswith("bridge_cluster_"):
        return int(label.replace("bridge_cluster_", ""))
    if label.startswith("cluster_"):
        return int(label.replace("cluster_", ""))
    return int(label)


def recommend_top5_for_tile(tile: Dict[str, float], artifacts: RecommendationArtifacts) -> Dict[str, Any]:
    prepared = prepare_tile(tile, artifacts.reference_predictions)
    X_new = prepared[FEATURE_COLUMNS]

    predicted_label = str(artifacts.model.predict(X_new)[0])
    predicted_probabilities = artifacts.model.predict_proba(X_new)[0]
    predicted_probability = float(predicted_probabilities.max())

    classifier = artifacts.model.named_steps["model"]
    class_labels = [str(c) for c in classifier.classes_]
    probability_lookup = {
        _extract_cluster_id_from_model_label(label): prob
        for label, prob in zip(class_labels, predicted_probabilities)
    }

    plants = artifacts.plants.copy()
    plant_bridge_ids = plants["bridge_cluster_id"].astype(int).to_numpy()
    cluster_affinity = np.array([probability_lookup.get(cluster_id, 0.0) for cluster_id in plant_bridge_ids], dtype=float)

    plant_light_index = plants["plant_light_index"].fillna(plants["plant_light_index"].median()).to_numpy(dtype=float)
    light_fit = np.exp(-(((prepared.iloc[0]["tile_light_index"] - plant_light_index) / 0.25) ** 2))

    indoor_bonus = np.minimum(plants["indoor_use_score"].fillna(0).to_numpy(dtype=float) * 5, 15)
    flex_bonus = np.minimum(plants["light_flexibility"].fillna(0).to_numpy(dtype=float) * 3, 10)
    temp_bonus = np.minimum(plants["temp_context_score"].fillna(0).to_numpy(dtype=float) * 4, 8)

    scores = (cluster_affinity * 70) + (light_fit * 15) + indoor_bonus + flex_bonus + temp_bonus
    top_indices = np.argsort(scores)[-5:][::-1]

    top5 = plants.iloc[top_indices][
        ["latin", "common", "plant_cluster_label", "bridge_cluster_label"]
    ].copy()
    top5["recommendation_score"] = scores[top_indices]
    top5["cluster_probability_for_species"] = cluster_affinity[top_indices]

    return {
        "predicted_cluster_label": predicted_label,
        "predicted_probability": predicted_probability,
        "prepared_row": prepared,
        "top5": top5.reset_index(drop=True),
    }


if __name__ == "__main__":
    ROOT = Path(__file__).resolve().parents[1]
    artifacts = load_artifacts(ROOT)
    sample_tile = {
        "BUILDING_ORIENTATION": 0,
        "RATIO_N": 0.15,
        "RATIO_E": 0.35,
        "RATIO_S": 0.30,
        "RATIO_W": 0.20,
        "UDI": 62.0,
        "SUN_HOURS": 510.0,
        "RADIATION": 138.0,
    }
    result = recommend_top5_for_tile(sample_tile, artifacts)
    print("Predicted cluster:", result["predicted_cluster_label"])
    print("Predicted probability:", round(result["predicted_probability"], 4))
    print(result["top5"].to_string(index=False))
