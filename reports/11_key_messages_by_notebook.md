# Key Messages by Notebook

## Notebook 04
### Central Idea
The plant catalog is not used as free text, but as a source of encoded and clustered environmental profiles.

### Key Messages
- The encoding preserves enough environmental diversity to justify clustering.
- Between `k=6` and `k=7`, the best result was `k=7`.
- Botanical clusters represent operational families of requirements, not absolute botanical labels.
- Several botanical differences stop being distinguishable from geometry, which is why `bridge clusters` appear later.

## Notebook 05
### Central Idea
Geometry does not predict species directly; it first predicts operational botanical profiles.

### Key Messages
- The bridge label is built from compatibility between each tile and cluster profiles.
- `KMeans` generates the initial botanical organization.
- `RandomForest` learns to predict that organization from geometry.
- The target is imbalanced, but the base scoring remains sufficiently clear.
- `RandomForest` was the best model by `accuracy` and `macro_f1`.

## Notebook 06
### Central Idea
The predicted cluster does not replace species; it organizes them.

### Key Messages
- The model predicts a `bridge cluster`.
- Then, inside that cluster, concrete species are ordered in a top 5.
- The ranking combines cluster probability, light fit, and secondary bonuses.
- The concentration of certain species in top 1 indicates ranking stability, not arbitrariness.

## Notebook 07
### Central Idea
The final export integrates the complete chain: simulation, classification, and recommendation.

### Key Messages
- The final CSV is already a complete operational artifact.
- The classifier's average probability is high.
- The average top 1 score is strong enough to support external use.
- The output preserves traceability from geometry to the recommended species.

## Notebook 08
### Central Idea
This notebook validates the model, interprets its results, and prepares the move to Grasshopper.

### Key Messages
- `KMeans` and `RandomForest` do not compete: they are chained.
- The selected model was `RandomForest` with nearly perfect performance.
- The confusion matrix confirms that residual errors are minimal.
- Feature importances help explain the classifier's behavior.
- The project is already deployable in Grasshopper through external inference scripts.

## Cross-Cutting Message for the Whole Series
The system does not try to jump directly from geometry to species. First, it identifies what type of environment each tile represents and then recommends the most suitable species within that environmental type. This is the key that makes the pipeline more interpretable, more stable, and more defensible.
