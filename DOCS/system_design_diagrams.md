# Google Photos: AI Genie Production System Architecture Diagrams

This document contains production architecture diagrams for integrating the **AI Genie** pre-search assistant into **Google Photos**.

---

## 1. End-to-End System Architecture

```mermaid
flowchart TB
    %% STYLING
    classDef client fill:#E8F0FE,stroke:#1A73E8,stroke-width:2px,color:#174EA6;
    classDef ingestion fill:#E6F4EA,stroke:#137333,stroke-width:2px,color:#0D652D;
    classDef serving fill:#FEF7E0,stroke:#B06000,stroke-width:2px,color:#B06000;
    classDef storage fill:#FCE8E6,stroke:#C5221F,stroke-width:2px,color:#A50E0E;
    classDef coreEngine fill:#F3E8FD,stroke:#7627BB,stroke-width:2px,color:#7627BB;

    subgraph CLIENT_TIER ["1. CLIENT INTERFACE (Android / iOS / Web)"]
        direction TB
        SB["Search Input Box"]
        DB["300ms Debounce Gate"]
        TR["7-Rule Trigger Engine"]
        GS["Inline AI Genie Strip\n(Max 3 Rows: Who? Look? What?)"]
        CH["Interactive Chips\n(+ Phrase Injection)"]

        SB --> DB --> TR
        TR -- "Passes: Candidates >= 6" --> GS
        GS --> CH
        CH -- "Deterministic String Append" --> SB
    end
    class SB,DB,TR,GS,CH client;

    subgraph INGESTION_TIER ["2. ASYNC INGESTION PIPELINE (Backup Time)"]
        direction TB
        UP["Photo Upload (Colossus / GCS)"]
        PMP["Photos Media Processing Pipeline"]
        FN["FaceNet Face Clustering & OCR"]
        GVB["Gemini Vision Batch Extractor\n(14 Episodic Cue Dimensions)"]
        SCF["Privacy & Sensitive Content Gate\n(Redact NSFW, Medical, ID)"]
        BE["Roaring Bitset & Inverted Index Builder"]

        UP --> PMP --> FN --> GVB --> SCF --> BE
    end
    class UP,PMP,FN,GVB,SCF,BE ingestion;

    subgraph STORAGE_TIER ["3. STORAGE & INDEX CATALOG"]
        direction TB
        CS["Cloud Spanner\n(Master Photo Metadata)"]
        BT["Bigtable / Flash Cache\n(Episodic Memory Bitsets)"]
        LOCAL_DB["On-Device Local Cache\n(SQLite + Roaring Bitmaps)"]

        BE --> CS
        BE --> BT
        BT -. "Wi-Fi Idle Sync" .-> LOCAL_DB
    end
    class CS,BT,LOCAL_DB storage;

    subgraph SERVING_TIER ["4. DUAL-TIER DISAMBIGUATION ENGINE"]
        direction TB
        
        subgraph TIER1 ["Tier 1: On-Device (Android AICore / iOS CoreML)"]
            T1_LU["Local Inverted Index Lookup (<5ms)"]
            T1_SE["Client C++ Shannon Entropy Ranker"]
            T1_CP["Deterministic Phrase Composer"]
            T1_LU --> T1_SE --> T1_CP
        end

        subgraph TIER2 ["Tier 2: Cloud Edge (Envoy / Borg C++ Service)"]
            T2_GW["Google Edge PoP (HTTP/3 QUIC)"]
            T2_WS["Stateless Disambiguation Worker (Borg)"]
            T2_SE["Distributed Shannon Entropy Engine"]
            T2_GW --> T2_WS --> T2_SE
        end
    end
    class T1_LU,T1_SE,T1_CP,T2_GW,T2_WS,T2_SE serving;

    subgraph DOWNSTREAM ["5. ASK PHOTOS RETRIEVAL BACKEND"]
        direction TB
        AP["Ask Photos Query Parser"]
        SCANN["ScaNN Multimodal Vector Search (Gemini)"]
        HYB["Hybrid Ranker\n(Lexical + Visual Vector Similarity)"]
        GRID["Ranked Photo Grid Display"]

        AP --> SCANN --> HYB --> GRID
    end
    class AP,SCANN,HYB,GRID coreEngine;

    %% CROSS-TIER CONNECTIONS
    TR -- "High-End Mobile" --> T1_LU
    T1_CP --> GS
    TR -- "Web / Low-End Mobile" --> T2_GW
    T2_SE --> GS
    LOCAL_DB <--> T1_LU
    BT <--> T2_WS

    SB -- "User Submits Multi-Cue Search" --> AP
```

---

## 2. Real-Time Serving Sequence Diagram (Sub-50ms Keystroke Path)

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Searcher)
    participant UI as Search UI & Input
    participant Debounce as Debounce Gate (300ms)
    participant Trigger as 7-Rule Trigger Engine
    participant Index as Inverted Bitset Index
    participant Entropy as Shannon Entropy Selector
    participant AskPhotos as Ask Photos Backend (Gemini)

    User->>UI: Types "pool"
    UI->>Debounce: Queue keystroke event
    Note over Debounce: User pauses for 300ms
    Debounce->>Trigger: Evaluate query "pool"

    Trigger->>Index: Lookup candidate count matching "pool"
    Index-->>Trigger: Returns 83 candidate IDs across 4 time clusters
    Note over Trigger: Rule 1: Non-empty (Pass)<br/>Rule 3: Count >= 6 (Pass: 83)<br/>Rule 4: Vague 2-of-3 check (Pass: No person/date)

    Trigger->>Entropy: Fetch attributes of 83 candidates
    Entropy->>Entropy: Compute H(A) for Who, Look, Occasion, Place
    Entropy->>Entropy: Filter out 0-match options & weight episodic cues (1.3x)
    Entropy-->>UI: Return Top 3 Questions (Who?, Look?, Occasion?)

    UI-->>User: Animate Genie Strip below search bar (<35ms total)
    Note over User: Reads options: [Friends], [Outdoors], [Summer]
    
    User->>UI: Taps chip "[Friends]"
    UI->>UI: Injects into search bar -> "pool, with friends"
    UI->>Trigger: Re-evaluate with new query
    Trigger->>Index: Intersect Bitsets ("pool" AND "friends")
    Index-->>UI: Remaining candidates: 24 photos (Chips update instantly)

    User->>UI: Taps chip "[Outdoors]"
    UI->>UI: Injects into search bar -> "pool, with friends, outdoors"

    User->>UI: Taps [Search] / Hits Enter
    UI->>AskPhotos: Submit rich multi-cue prompt
    Note over AskPhotos: Gemini Multimodal ScaNN Retrieval<br/>Pinpoints target photo in Top 1-4 slots
    AskPhotos-->>UI: Return high-precision photo results grid
    UI-->>User: User finds target photo in <10 seconds!
```

---

## 3. Asynchronous Backup Ingestion Pipeline (One-Time Media Scan)

```mermaid
flowchart LR
    %% STYLING
    classDef step fill:#E8F0FE,stroke:#1A73E8,stroke-width:2px,color:#174EA6;
    classDef ai fill:#F3E8FD,stroke:#7627BB,stroke-width:2px,color:#7627BB;
    classDef safety fill:#FCE8E6,stroke:#C5221F,stroke-width:2px,color:#A50E0E;
    classDef db fill:#E6F4EA,stroke:#137333,stroke-width:2px,color:#0D652D;

    A["New Photo Uploaded\n(Device Backup)"] --> B["PMP Base Processing\n(EXIF, GPS, FaceNet)"]
    B --> C["Gemini Vision Flash\nBatch Pipeline (TPU v5e)"]
    
    subgraph GEMINI_TAGGING ["14 Episodic Dimensions Extracted"]
        C1["Who: Solo / Friends / Family"]
        C2["Setting: Beach / Pool / Café"]
        C3["Look: Red dress / Outdoors / Night"]
        C4["Occasion: Birthday / Trip / Festival"]
        C5["Activity: Swimming / Dining / Dancing"]
    end
    C --> GEMINI_TAGGING
    GEMINI_TAGGING --> D["Sensitive Content\n& Privacy Filter"]
    
    D -- "Safe" --> E["Bitset Serializer\n(Roaring Bitmap IDs)"]
    D -- "Sensitive/NSFW/Medical" --> F["Flag is_sensitive = true\n(Excluded from Chips)"]

    E --> G[("Cloud Spanner\n& Bigtable")]
    G -. "Background Delta Sync" .-> H[("Client SQLite Cache")]

    class A,B,E step;
    class C,C1,C2,C3,C4,C5 ai;
    class D,F safety;
    class G,H db;
```

---

## 4. Algorithmic Decision Tree: The 7-Rule Trigger Engine

```mermaid
flowchart TD
    classDef check fill:#FEF7E0,stroke:#B06000,stroke-width:2px,color:#B06000;
    classDef pass fill:#E6F4EA,stroke:#137333,stroke-width:2px,color:#0D652D;
    classDef halt fill:#FCE8E6,stroke:#C5221F,stroke-width:2px,color:#A50E0E;

    START(["User Keystroke Input"]) --> R1{"Rule 1: Length >= 2 chars?"}
    R1 -- "No (<2 chars)" --> S1["Suppress Genie (Stay Hidden)"]
    R1 -- "Yes" --> R2{"Rule 2: Genie Enabled\n& Ask Photos On?"}
    
    R2 -- "No (Feature Flag Off)" --> S1
    R2 -- "Yes" --> R3{"Rule 3: Candidate Count >= 6?"}

    R3 -- "No (1 - 5 photos)" --> S2["Suppress: Results are already specific"]
    R3 -- "Yes" --> R4{"Rule 4: Vague Check\n(Lacks 2 of 3 anchors)?"}

    R4 -- "No: Query is already specific\n(e.g., 'Mom August 2024 Paris')" --> S3["Suppress: User already provided precise anchors"]
    R4 -- "Yes (Lacks 2 of 3)" --> R5{"Rule 5: Candidate Dispersion\n(Spans >= 2 event clusters)?"}

    R5 -- "No: Single 2-min burst" --> S4["Suppress: Single event, not ambiguous"]
    R5 -- "Yes" --> R6{"Rule 6: Any matched terms?"}

    R6 -- "No (All terms unmatched)" --> S5["Show Zero-Match Strip (Helpful tips)"]
    R6 -- "Yes" --> R7{"Rule 7: Session Dismissals < 2?"}

    R7 -- "No (Dismissed >= 2 times)" --> S6["Suppress: Respect user preference"]
    R7 -- "Yes" --> EXEC["TRIGGER GENIE STRIP\n(Compute Shannon Entropy & Render Chips)"]

    class R1,R2,R3,R4,R5,R6,R7 check;
    class EXEC pass;
    class S1,S2,S3,S4,S5,S6 halt;
```
