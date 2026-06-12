BioSpatial Intelligence - Academic ML Workflow
Context
This project translates simulations and geometric proxies from an interior space into a useful plant recommendation. The problem is not solved by predicting species directly with ML because the available dataset does not include real species-cell labels. For that reason, the pipeline is organized into two complementary layers:

Multiclass spatial classification.
Interpretable species recommendation.
General Objective
Build a reproducible Python and Jupyter workflow that classifies interior cells according to their luminous condition and recommends a top 5 of compatible species for each TILE_ID.

Specific Objectives
Audit the spatial dataset and understand its real ranges.
Build spatial labels through hybrid rules.
Train and compare tabular classifiers.
Encode a house plants catalog for interpretable recommendation.
Export a final CSV reusable in Grasshopper.
Unit of Analysis
The unit of analysis is the row or spatial cell in the dataset. To avoid technical ambiguity, the pipeline uses two references:

ROW_ID: unique row identifier, used to assemble results without duplication.
TILE_ID: spatial reference reusable in Grasshopper and in the simulation reading.
Each row in the spatial dataset represents a localized condition inside the simulation.

Central Methodological Problem
The geometry dataset contains spatial conditions, but it does not include a ready supervised label. The plant dataset contains species and requirements, but it does not include real pairings with the cells. This disconnection requires the problem to be framed as follows:

First, classify the cell according to its spatial condition.
Then, recommend species within that condition.
This approach reduces complexity, aligns with the course, and makes the project easier to defend.

Spatial Classes
unsuitable
shade_tolerant
medium_indirect
bright_indirect
high_light
unsuitable is reserved only for real underexposure or overexposure extremes. It is not used as a synonym for normal low light.

Datasets Used
data/raw/geometry_dataset_daylight.csv
data/raw/house_plants.csv
data/raw/simulacion.png
data/raw/dataset_columnas.png
data/raw/Biospatial_Intelligence_Machine-Learning.pdf
Working Hypothesis
It is possible to classify an interior cell using geometric and environmental proxies, and then translate that class into a plant recommendation without depending on a complex recommendation system or previously annotated species-cell labels.

Notebook Pipeline
01_eda_geometry.ipynb
02_build_spatial_labels.ipynb
03_eda_house_plants.ipynb
04_encode_plants_for_recommendation.ipynb
05_train_spatial_classifier.ipynb
06_recommend_species.ipynb
07_results_and_export.ipynb
08_validate_plant_cluster_recommender.ipynb
Methodology
1. Spatial EDA
The quality of the geometry dataset is audited, and the ranges, distributions, and correlations of the following variables are reviewed:

UDI
SUN_HOURS
RADIATION
The expected result is a clear reading of which variables are useful for labeling and which variables are useful for training.

During this stage, several percentiles are inspected for two different purposes:

exploring extremes and distribution biases
comparing possible discretization schemes
That is why percentiles such as p10, p25, p33, p50, p67, p75, p90, and p95 appear in the EDA. Not all of those cut points are later used for classification; several are diagnostic only.

2. Hybrid Labeling
The spatial labels are built with a mixture of:

observed dataset percentiles
a simple physical criterion
First, three ordinal levels are created:

UDI_level
SUN_level
RAD_level
Only p20, p40, p60, and p80 are used to build those levels. The reason is that these four cut points divide each variable into five ordered and comparable bands:

level 1: <= p20
level 2: p20-p40
level 3: p40-p60
level 4: p60-p80
level 5: > p80
This scheme was chosen because it is simple to explain, sufficiently stable, and more appropriate for a 5-level classification than using only quartiles or thirds.

The levels are then combined as:

exposure_score = 0.45 * UDI_level + 0.20 * SUN_level + 0.35 * RAD_level
The spatial class is then assigned with exception rules for unsuitable.

3. Supervised Classification
The model learns to predict spatial_label using only geometric proxies that make sense for deployment:

BUILDING_ORIENTATION
RATIO_N
RATIO_E
RATIO_S
RATIO_W
The compared models are:

Logistic Regression
Random Forest
k-NN
SVM
Main metrics:

Accuracy
Macro F1
Confusion matrix
4. Interpretable Species Recommendation
The recommendation is not solved with another complex ML model. Instead:

The light requirements in the plant dataset are normalized.
Direct-light and diffuse-light tolerance indicators are created.
A score is assigned to each species according to the spatial class.
A top 5 with justification is generated.
The score is not interpreted as a probability, but as a comparative index within the available species set. Its function is to order plausible options with traceable criteria.

Score factors:

main light compatibility
direct or diffuse light tolerance
indoor use
temperature as a weak context
general light flexibility
Key Methodological Decisions
The ML target is the spatial class, not the species.
RELATIVE_HUMIDITY is considered a discard candidate because it has almost no variation.
Temperature does not lead the recommendation because there is no per-cell temperature value in the spatial dataset.
The top 5 is based on interpretable rules and scoring to maintain academic traceability.
Generated Files
Processed
data/processed/geometry_data_quality.csv
data/processed/geometry_percentiles.csv
data/processed/geometry_distribution_summary.csv
data/processed/geometry_correlation_pairs.csv
data/processed/geometry_feature_grid_summary.csv
data/processed/geometry_eda_conclusions.csv
data/processed/label_thresholds.csv
data/processed/spatial_label_distribution.csv
data/processed/spatial_label_summary.csv
data/processed/geometry_labeled.csv
data/processed/plants_data_quality.csv
data/processed/plants_repeated_latin.csv
data/processed/plants_temperature_summary.csv
data/processed/plants_eda_notes.csv
data/processed/plants_light_group_distribution.csv
data/processed/plants_derived_summary.csv
data/processed/plants_encoded.csv
data/processed/model_comparison.csv
data/processed/best_model_confusion_matrix.csv
data/processed/model_selection_notes.csv
data/processed/geometry_predictions.csv
data/processed/tile_plant_recommendations_intermediate.csv
Export
exports/tile_plant_recommendations.csv
Model
models/spatial_classifier.joblib
models/plant_cluster_classifier.joblib
How to Run the Project
Run the notebooks in order inside Jupyter. Each notebook generates files used as input by the next one. The recommendation is not to skip stages because the pipeline has intermediate dependencies.

Future Integration With Grasshopper
The first phase exports a final CSV that keeps TILE_ID as a spatial reference, but uses ROW_ID as a unique technical key to avoid duplication. A later phase can load models/plant_cluster_classifier.joblib to move classifier inference outside the notebook and bring it closer to the Grasshopper workflow.

Limitations
The species recommendation is interpretable, but it does not replace expert botanical validation.
Temperature is used as a weak context because there is no direct spatial value.
If the spatial class balance becomes highly uneven, the hybrid labeling cut points will need adjustment.
Some repeated species or cultivars may dominate the ranking and require later refinement.
Expected Final Result
For each spatial cell, the project produces:

an interpretable spatial class
a model prediction
a top 5 species list with score and justification
This produces a legible, replicable workflow compatible with future integration into computational design tools.
