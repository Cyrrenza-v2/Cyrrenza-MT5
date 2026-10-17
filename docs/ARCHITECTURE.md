# Architecture Overview

This document provides a high-level architecture diagram for the Cyrrenza-MT5 project. The diagram shows major components for data ingest and storage, preprocessing, training, evaluation, serving, and infrastructure/operations.

```mermaid
flowchart LR
  %% Data layer
  subgraph DATA[Data & Storage]
    A[Raw Parallel Corpora] --> B[Object Storage (S3 / GCS)]
    C[Monolingual Data / Back-translation] --> B
    B --> D[Versioned Datasets]
  end

  %% Preprocessing
  subgraph PRE[Preprocessing]
    D --> E[Cleaning & Filtering]
    E --> F[Normalization & Tokenization (SentencePiece)]
    F --> G[Serialized Dataset (TFRecord / Arrow)]
  end

  %% Training
  subgraph TRAIN[Training & Experiments]
    G --> H[Distributed Trainer (TPU / Multi-GPU)]
    H --> I[MT5 Model (base / large / xl)]
    H --> J[Checkpoints → Object Storage]
    H --> K[Experiment Tracking (Weights & Biases / MLflow)]
  end

  %% Evaluation
  subgraph EVAL[Evaluation]
    J --> L[Automated Eval Scripts]
    L --> M[Metrics: BLEU, chrF, COMET, SacreBLEU]
    M --> N[Evaluation Reports]
  end

  %% Serving
  subgraph SERV[SERVING & API]
    J --> O[Model Packaging (Docker / OCI)]
    O --> P[Inference Service (FastAPI / Triton / TorchServe)]
    P --> Q[API Gateway / Load Balancer]
    Q --> R[Clients: Web / Mobile / Batch Jobs]
  end

  %% Infrastructure & CI/CD
  subgraph INFRA[Infrastructure & Ops]
    S[Kubernetes / Kubeflow / Vertex AI] --- H
    T[CI/CD (GitHub Actions)] --> O
    U[Monitoring & Logging (Prometheus, Grafana, ELK)] --> P
    V[Secrets & Config (Vault, KMS)] --> H
  end

  %% Notes
  classDef dashed stroke-dasharray: 5 5;
  class DATA,PRE,TRAIN,EVAL,SERV,INFRA dashed;

  click B "#" "Object storage holds raw and derived datasets and checkpoints"
```

Notes
- Replace service/tool examples (S3, W&B, Triton) with the concrete choices used by the project.
- This is intentionally high-level; add more detail (networking, VPCs, dataset splits, training schedules) if you want per-component diagrams.
