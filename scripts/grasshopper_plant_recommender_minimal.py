from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import joblib
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PROCESSED_DIR = ROOT / "data" / "processed"
MODEL_PATH = ROOT / "models" / "plant_cluster_classifier.joblib"

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

_MODEL = joblib.load(MODEL_PATH)
_PLANTS = pd.read_csv(PROCESSED_DIR / "plants_encoded.csv")
_CLUSTER_PROFILES = pd.read_csv(PROCESSED_DIR / "plants_cluster_profiles.csv")
_REFERENCE = pd.read_csv(PROCESSED_DIR / "geometry_predictions.csv")

BRIDGE_KEY_COLS = [
    "sun_min_h_day",
    "sun_max_h_day",
    "lux_min",
    "lux_max",
    "sun_center_h_day",
    "lux_center",
    "plant_light_index",
]

if not {"bridge_cluster_id", "bridge_cluster_label"}.issubset(_PLANTS.columns):
    if {"bridge_cluster_id", "bridge_cluster_label"}.issubset(_CLUSTER_PROFILES.columns):
        bridge_map = _CLUSTER_PROFILES[
            ["plant_variety_cluster", "bridge_cluster_id", "bridge_cluster_label"]
        ].drop_duplicates()
    else:
        bridge_profiles = _CLUSTER_PROFILES[BRIDGE_KEY_COLS].drop_duplicates().reset_index(drop=True).copy()
        bridge_profiles["bridge_cluster_id"] = bridge_profiles.index.astype(int)
        bridge_profiles["bridge_cluster_label"] = "bridge_cluster_" + bridge_profiles["bridge_cluster_id"].astype(str)
        bridge_map = (
            _CLUSTER_PROFILES[["plant_variety_cluster"] + BRIDGE_KEY_COLS]
            .merge(bridge_profiles, on=BRIDGE_KEY_COLS, how="left")
            [["plant_variety_cluster", "bridge_cluster_id", "bridge_cluster_label"]]
            .drop_duplicates()
        )
    _PLANTS = _PLANTS.merge(bridge_map, on="plant_variety_cluster", how="left")

_PLANT_BRIDGE_IDS = _PLANTS["bridge_cluster_id"].astype(int).to_numpy()
_PLANT_LIGHT_INDEX = _PLANTS["plant_light_index"].fillna(_PLANTS["plant_light_index"].median()).to_numpy(dtype=float)
_INDOOR_BONUS = np.minimum(_PLANTS["indoor_use_score"].fillna(0).to_numpy(dtype=float) * 5, 15)
_FLEX_BONUS = np.minimum(_PLANTS["light_flexibility"].fillna(0).to_numpy(dtype=float) * 3, 10)
_TEMP_BONUS = np.minimum(_PLANTS["temp_context_score"].fillna(0).to_numpy(dtype=float) * 4, 8)


def _minmax_against_reference(value: float, series: pd.Series) -> float:
    min_val = float(series.min())
    max_val = float(series.max())
    if max_val == min_val:
        return 0.0
    return (float(value) - min_val) / (max_val - min_val)


def _extract_cluster_id(label: str) -> int:
    if label.startswith("bridge_cluster_"):
        return int(label.replace("bridge_cluster_", ""))
    if label.startswith("cluster_"):
        return int(label.replace("cluster_", ""))
    return int(label)


def recommend_for_tile(
    BUILDING_ORIENTATION: float,
    RATIO_N: float,
    RATIO_E: float,
    RATIO_S: float,
    RATIO_W: float,
    UDI: float,
    SUN_HOURS: float,
    RADIATION: float,
) -> Dict[str, Any]:
    sun_h_day_estimated = SUN_HOURS / 365.0 if SUN_HOURS > 24 else SUN_HOURS
    sun_norm = _minmax_against_reference(SUN_HOURS, _REFERENCE["SUN_HOURS"])
    radiation_norm = _minmax_against_reference(RADIATION, _REFERENCE["RADIATION"])
    udi_norm = _minmax_against_reference(UDI, _REFERENCE["UDI"])
    tile_light_index = 0.45 * sun_norm + 0.45 * radiation_norm + 0.10 * udi_norm

    X_new = pd.DataFrame([
        {
            "BUILDING_ORIENTATION": BUILDING_ORIENTATION,
            "RATIO_N": RATIO_N,
            "RATIO_E": RATIO_E,
            "RATIO_S": RATIO_S,
            "RATIO_W": RATIO_W,
            "UDI": UDI,
            "SUN_HOURS": SUN_HOURS,
            "RADIATION": RADIATION,
        }
    ])

    pred_label = str(_MODEL.predict(X_new)[0])
    pred_proba = _MODEL.predict_proba(X_new)[0]
    pred_prob = float(pred_proba.max())

    classifier = _MODEL.named_steps["model"]
    class_labels = [str(c) for c in classifier.classes_]
    probability_lookup = {
        _extract_cluster_id(label): prob
        for label, prob in zip(class_labels, pred_proba)
    }

    cluster_affinity = np.array([probability_lookup.get(c, 0.0) for c in _PLANT_BRIDGE_IDS], dtype=float)
    light_fit = np.exp(-(((tile_light_index - _PLANT_LIGHT_INDEX) / 0.25) ** 2))
    scores = (cluster_affinity * 70) + (light_fit * 15) + _INDOOR_BONUS + _FLEX_BONUS + _TEMP_BONUS
    top_indices = np.argsort(scores)[-5:][::-1]

    top5 = _PLANTS.iloc[top_indices][["latin", "common", "plant_cluster_label", "bridge_cluster_label"]].copy()
    top5["recommendation_score"] = scores[top_indices]
    top5["cluster_probability_for_species"] = cluster_affinity[top_indices]

    return {
        "predicted_cluster_label": pred_label,
        "predicted_probability": pred_prob,
        "sun_h_day_estimated": sun_h_day_estimated,
        "tile_light_index": tile_light_index,
        "top5": top5.reset_index(drop=True),
    }


if __name__ == "__main__":
    result = recommend_for_tile(
        BUILDING_ORIENTATION=0,
        RATIO_N=0.15,
        RATIO_E=0.35,
        RATIO_S=0.30,
        RATIO_W=0.20,
        UDI=62.0,
        SUN_HOURS=510.0,
        RADIATION=138.0,
    )
    print(result["predicted_cluster_label"])
    print(round(result["predicted_probability"], 4))
    print(result["top5"].to_string(index=False))
