# Oral Summary 04-08

## Short Version
The project starts from two different data worlds: on one side, a botanical catalog of `house plants`; on the other, a geometry and simulation dataset by tile. The challenge was not only to classify cells, but to connect spatial conditions with plausible indoor species.

In notebook 04, botanical language was translated into interpretable environmental variables, and `KMeans` was then used to group species with similar requirements. Between `k=6` and `k=7`, the best result was `k=7`, with better inertia and a better `silhouette score`. However, those botanical clusters were not always distinguishable from geometry, so they were later consolidated into fewer `bridge clusters`.

In notebook 05, a bridge label between geometry and plants was built. From estimated sun exposure and the synthetic light index, each cell was compared with the cluster profiles. This produced a defensible supervised target. Several models were compared on that target, and `RandomForest` was the best one, with practically perfect `accuracy` and `macro_f1`.

In notebook 06, the model no longer predicts species directly. First, it predicts the `bridge cluster` most compatible with the cell, and then, inside that cluster, a top 5 species ranking is assembled. The current results show that a large part of the dataset falls into `bridge_cluster_2`, which is why species such as `Peperomia obtusifolia` and `Peperomia clusiifolia` appear very frequently as top 1.

In notebook 07, everything is consolidated into a final exportable CSV. The result has 43,100 rows and 55 columns, with a very high average predicted probability and a strong top 1 score, indicating that the pipeline already works as an operational artifact.

Finally, notebook 08 validates, interprets, and prepares the transition to Grasshopper. It explains why `KMeans` and `RandomForest` do not replace each other, but are chained: the first organizes the botanical universe, and the second makes it usable for new simulations.

## Very Short Closing Version
First, we organize plants into environmental families. Then, we train a model to recognize which family fits each tile. Finally, we translate that family into a top 5 of concrete species. This is how the system moves from simulated geometry to interpretable botanical recommendation.
