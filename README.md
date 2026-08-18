# AI Railway Maintenance Scheduling & Traffic Coordination Engine
*A Next-Generation Multi-Objective Optimization, Conflict Detection, and Real-Time Dynamic Rescheduling Platform for Indian Railways*

---

## 🚆 Executive Summary

Modern railway networks handle dense passenger and freight traffic while maintaining safety-critical infrastructure across thousands of track kilometers. In high-density corridors like **Indian Railways Delhi Division (Northern Railway: NDLS – TKJ – ANVT – GZB)**, scheduling track maintenance (P.Way), 25kV Overhead Electrification (OHE), Signalling & Telecommunication (S&T), and Rolling Stock overhauls is a complex combinatorial optimization problem.

Traditional manual planning leads to:
- **Spatial Conflicts**: Multiple engineering departments claiming identical track sections simultaneously.
- **Safety Violations**: Work taking place adjacent to live 25kV traction lines or during high-speed train movements without statutory traffic/power blocks.
- **Resource Inefficiencies**: Track machine idling, gang overtime breaches (>48 hr weekly statutory caps), and depot material stockouts.
- **Cascading Delays**: Emergency rail fractures or wheel defects causing severe train punctuality losses due to lack of dynamic rescheduling tools.

The **AI Railway Maintenance Scheduling Engine** is an enterprise-grade full-stack platform that combines **Multi-Objective Genetic Algorithms (NSGA-II inspired)**, **Deterministic Conflict Detection Rules**, **Real-Time Dynamic Rescheduling**, **Interactive Track Possession Visualizers**, and **Enterprise IoT / IT Feeds (ICMS, FOIS, OMRS/WILD, USFD)**.

---

## 🏛️ System Architecture

The application is architected as a high-performance full-stack TypeScript platform:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client (React 18 + Tailwind)                  │
├───────────────────┬───────────────────┬─────────────────────────────────┤
│ Operational Hub   │ Interactive Track │ Schedule Gantt & Timeline       │
│ Conflict Center   │ Optimizer Studio  │ What-If Scenario Sandbox        │
│ Disruption Engine │ Resource Fleet    │ Long-Term Capex Planner         │
│ Integrations Hub  │ Gemini Explainer  │ Dual Language (English / Hindi) │
└───────────────────┴───────────────────┴─────────────────────────────────┘
                                   │  HTTP / REST & WebSocket Telemetry
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Node.js / Express Backend Engine                 │
├─────────────────────────────────────────────────────────────────────────┤
│  REST API Router (/api/work-requests, /api/conflicts, /api/schedule)    │
│  ├─ 🧬 Multi-Objective Genetic Algorithm Solver (ga-solver.ts)          │
│  ├─ 🛡️ Multi-Category Conflict Detection Engine (conflict-detector.ts)  │
│  ├─ ⚡ Sub-10s Dynamic Rescheduler & Disruption Resolver (rescheduler.ts)│
│  ├─ 🔮 What-If Alternative Generator (alternative-generator.ts)         │
│  ├─ 🤖 Gemini Reasoning & Justification Service (gemini-service.ts)     │
│  └─ 📡 IR Systems Telemetry Ingestion (ICMS, FOIS, WILD, USFD)          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Modules & Functional Capabilities

### 1. Operational Command Center
- **Divisional Status Overview**: Live monitoring of Northern Railway's Delhi-Ghaziabad mainline.
- **Non-Traffic Window Tracker**: Real-time identification of designated night maintenance windows (`01:30 - 05:30 IST`).
- **High-Density KPI Matrix**: Instant visibility into total work orders, critical safety conflicts, master schedule fitness scores ($F$), active track possessions, and IoT stream status.

### 2. Interactive Track Possession Schematic Map
- **Section & Yard Layouts**: High-fidelity schematics across NDLS (New Delhi), TKJ (Tilak Bridge), ANVT (Anand Vihar), and GZB (Ghaziabad).
- **Track-Level Block Reservations**: Clear visual cues for UP Main, DN Main, Reversible lines, and yard turnouts.
- **25kV OHE Isolation Layer**: Instant identification of energized lines vs. earthed/isolated power blocks.
- **Interactive Conflict & Request Highlighting**: Direct selection of work requests and overlapping spatial possession hazards.

### 3. Multi-Category Conflict Detection Engine
The engine evaluates 5 distinct conflict dimensions with sub-millisecond deterministic evaluation:
1. **Spatial Conflicts**: Two work orders claiming overlapping track chainages and tracks simultaneously.
2. **Resource Conflicts**: The same engineering gang (P.Way/OHE/S&T) or high-value track machine (e.g., CSM-03 Tamper, BCM-01 Ballast Cleaner) double-booked.
3. **Safety Violations**: 
   - Working within 2 meters of energized 25kV OHE without an approved Power Block.
   - P.Way heavy maintenance adjacent to active high-speed lines without speed restrictions/caution orders.
4. **Temporal Conflicts**: Work scheduled outside non-traffic slots during peak passenger traffic hours.
5. **Dependency Violations**: Work sequence errors (e.g., scheduling track tamping *before* deep ballast screening or rail stress equalization).

### 4. Multi-Objective Genetic Algorithm (GA) Optimization Studio
The scheduling engine uses a customizable multi-objective evolutionary solver with Pareto frontier exploration.

#### **Mathematical Fitness Function**:
$$\text{Fitness} = \max\Big(0.05, \, \min\big(0.99, \, \Phi\big)\Big)$$

Where:
$$\Phi = w_1 \cdot C_{\text{rate}} + w_2 \cdot (1 - I_{\text{ratio}}) + w_3 \cdot (1 - T_{\text{ratio}}) + w_4 \cdot P_{\text{weighted}} - w_5 \cdot P_{\text{conflict}} - w_6 \cdot P_{\text{delay}}$$

- $C_{\text{rate}}$: Work Order Completion Rate ($\frac{\text{Assigned}}{\text{Total}}$)
- $I_{\text{ratio}}$: Resource Idling Time Ratio
- $T_{\text{ratio}}$: Machine/Gang Travel Distance & Setup Penalty
- $P_{\text{weighted}}$: Priority Score (Critical: 4x, High: 3x, Medium: 2x, Low: 1x)
- $P_{\text{conflict}}$: Conflict Penalty ($0.3 \times \text{Critical} + 0.1 \times \text{Warning}$)
- $P_{\text{delay}}$: Unscheduled work delay penalty

#### **Pareto Frontier Generation**:
- **Balanced Optimal**: Harmonized tradeoff across all 6 parameters.
- **Safety & Punctuality Focused**: Maximum priority on zero train delays and zero spatial overlaps.
- **Throughput Maximizer**: Schedules maximum work orders within available maintenance blocks.
- **Resource Conservation**: Minimizes gang travel time, machine fuel consumption, and crew overtime.

### 5. Interactive What-If Scenario Sandbox & Gemini AI Reasoning
- Enables Section Controllers and Divisional Engineers to test candidate solutions before applying them to the live master schedule.
- Automated generation of 4 distinct mitigation strategies for every conflict:
  1. `TIME_SHIFT`: Shifting non-urgent jobs to adjacent night maintenance windows.
  2. `RESOURCE_SWAP`: Mobilizing standby certified gangs or auxiliary machinery.
  3. `LOCATION_SPLIT`: Subdividing track possession chainages.
  4. `WORK_COMBINATION`: Integrated shadow blocks (combining P.Way rail renewal with OHE wire adjustment under a single shutdown).
- **Gemini-Powered AI Explanations**: Generates natural language engineering justifications for safety compliance and regulatory auditing.

### 6. Sub-10s Dynamic Rescheduling & Disruption Simulator
Handles real-time network disruptions with rapid repair heuristics:
- **Emergency Rail Fractures / Weld Failures**: Immediately clears scheduled low-priority jobs, dispatches emergency USFD/Welding teams, and injects emergency traffic blocks.
- **Monsoon Flash Floods / Severe Weather**: Locks down open-track tamping and rail grinding while preserving yard/covered bay schedules.
- **Machine Breakdowns**: Automatically reallocates tasks to standby equipment with minimal schedule disruption.
- **WILD High-g Wheel Impact Alarms**: Instant automated work order creation for Tughlakabad (TKD) wheel lathe profiling.

### 7. Resource & Machine Fleet Manager
- **Personnel Gang Rosters**: Tracks keymen, gang mates, certified welders, and linemen against the **48-hour statutory weekly cap** to prevent fatigue-induced safety risks.
- **Heavy Track Machine Fleet**: Real-time monitoring of Continuous Action Tampers (CSM), Points Tampers (UNIMAT), Ballast Cleaning Machines (BCM), OHE Tower Wagons, and Ultrasonic Rail Testers (USFD).
- **Depot Material Inventory**: Track components (60kg UIC Rails, Elastic Rail Clips, GFN Liners), 25kV OHE Contact Wire, and S&T Relays with automated reorder threshold alerts.

### 8. Long-Term Strategic Planner & Capex Simulator
- **12-Month Capacity Projections**: Projects required maintenance hours vs. available track possession windows.
- **Rolling Stock Overhaul Bottlenecks**: Models coach Periodic Overhaul (POH) and locomotive schedules at Jagadhri (JUDW) and Charbagh (CB) workshops.
- **Monte Carlo Strategic Simulations**: Models Capex expansion scenarios:
  - Base Trend vs. Dedicated Freight Corridor (DFC) Traffic Shift (+25% Freight Throughput).
  - High-Speed Corridor Upgrades (160 km/h Mission Raftaar).

### 9. Indian Railways Enterprise IT & IoT Sensor Integrations
Pre-configured bi-directional connectors for Indian Railways core systems:
- **ICMS** (*Integrated Coaching Management System*): Real-time coach rake fitness and scheduled maintenance intervals.
- **FOIS** (*Freight Operations Information System*): Freight rake transit blocks, wagon maintenance, and crew availability.
- **OMRS / WILD** (*Wheel Impact Load Detectors & Acoustic Bearing Monitors*): IoT telemetry streams triggering automated wheel re-profiling alarms.
- **USFD Digital Testers** (*Ultrasonic Flaw Detection*): Rail micro-crack and flaw logs with GPS chainage tagging.
- **COIS & Section Control**: Real-time train timetable and punctuality telemetry.

---

## 🛠️ Technology Stack

| Domain | Technology / Library | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 (TypeScript) + Vite | High-performance reactive Single Page Application |
| **Styling & UI** | Tailwind CSS v4 | Dark command-center design system with WCAG AA compliance |
| **Icons** | `lucide-react` | Unified SVG vector icons for rail, safety, and equipment |
| **Backend API** | Node.js + Express (TypeScript / ESM) | RESTful API server with in-memory graph state |
| **AI Optimization** | Custom Genetic Algorithm Solver | Multi-objective genetic solver with Pareto ranking |
| **AI LLM Integration** | `@google/genai` (Gemini Flash) | Natural language explanation & regulatory audit generation |
| **Build Tooling** | Vite + `esbuild` + `tsx` | Instant development reload and optimized single-bundle build |

---

## 📁 Directory & Project Structure

```
├── .env.example                     # Environment template (GEMINI_API_KEY)
├── metadata.json                    # Application metadata & major capabilities
├── package.json                     # Dependencies and build scripts
├── server.ts                        # Express server entry point & REST API routes
├── vite.config.ts                   # Vite configuration with Tailwind plugin
├── tsconfig.json                    # TypeScript compiler configuration
└── src/
    ├── App.tsx                      # Root application & state router
    ├── main.tsx                     # React DOM bootstrap entry
    ├── index.css                    # Tailwind CSS imports & global styles
    ├── types/
    │   └── index.ts                 # Central TypeScript interfaces & domain models
    ├── data/
    │   └── mockRailwayData.ts       # Realistic Delhi Division operational seed data
    ├── server/
    │   ├── gemini-service.ts        # Gemini AI reasoning and natural language generation
    │   └── ai-engine/
    │       ├── ga-solver.ts         # Multi-Objective Genetic Algorithm & Pareto engine
    │       ├── conflict-detector.ts # Deterministic 5-category railway conflict engine
    │       ├── rescheduler.ts       # Sub-10s dynamic disruption response heuristics
    │       └── alternative-generator.ts # What-If scenario candidate generator
    └── components/
        ├── Header.tsx               # Top command bar, role selector, alerts & quick optimize
        ├── TrackPossessionMap.tsx   # Interactive SVG schematic track possession layout
        ├── ScheduleGantt.tsx        # 24-hour visual Gantt timeline of possessions
        ├── WorkRequestHub.tsx       # Work order intake, validation & CSV/JSON batch upload
        ├── ConflictCenter.tsx       # Safety conflict triage & statutory override audit log
        ├── OptimizationStudio.tsx   # GA parameter weights, convergence graphs & Pareto picker
        ├── AlternativeAnalysis.tsx  # Side-by-side What-If candidate trade-off comparison
        ├── DisruptionCenter.tsx     # Emergency disruption injector & real-time rescheduler
        ├── ResourceManager.tsx      # Gang rosters (48h rule), track machines & depot stock
        ├── LongTermPlanner.tsx      # 12-month demand vs capacity & Capex simulator
        └── IntegrationsHub.tsx      # ICMS, FOIS, WILD, USFD live feed connectors
```

---

## 🔌 API Reference Guide

### 1. Work Orders
- `GET /api/work-requests`: Retrieve all active work requests with status filtering.
- `POST /api/work-requests`: Submit a new maintenance work request (triggers auto-conflict detection).
- `DELETE /api/work-requests/:id`: Remove or cancel a work request.

### 2. Conflict Detection & Overrides
- `GET /api/conflicts`: List all active Spatial, Resource, Safety, Temporal, and Dependency conflicts.
- `POST /api/conflicts/:id/override`: Record a statutory override with engineer justification and audit trail.

### 3. AI Genetic Optimization & Pareto
- `GET /api/schedule`: Retrieve the current master schedule (v1.0+).
- `POST /api/schedule/optimize`: Execute the Genetic Algorithm optimizer with custom $w_1 - w_6$ weights.
- `POST /api/schedule/apply-pareto`: Commit a candidate Pareto solution to the active master schedule.

### 4. What-If Scenarios & Dynamic Rescheduling
- `GET /api/alternatives/:conflictId`: Generate candidate resolution strategies for a given conflict.
- `POST /api/alternatives/apply`: Apply a chosen alternative strategy to the master schedule.
- `POST /api/disruptions/trigger`: Execute sub-10s dynamic rescheduling in response to an emergency disruption event.

### 5. Enterprise Integrations & Telemetry
- `GET /api/integrations`: Get real-time connection status for ICMS, FOIS, WILD, and USFD.
- `POST /api/integrations/sync/:service`: Trigger manual synchronization with a specific telemetry service.
- `POST /api/integrations/trigger-wild-alarm`: Inject a simulated high-g wheel impact alert from line-side IoT sensors.
- `GET /api/supabase/status`: Check live connection status to Supabase PostgreSQL database and fetch DDL schema.
- `POST /api/supabase/sync-all`: Sync all work orders, schedules, and safety audits to your Supabase tables.

---

## 🗄️ Supabase Cloud Database Integration

The platform includes native, lazy-loaded support for connecting to your **Supabase PostgreSQL** project:

1. **Environment Variables**: Add your Supabase credentials via Settings:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_public_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key # (optional, for backend operations)
   ```
2. **Schema Migration**: Go to the **Integrations Hub** tab in the app and click **"Copy SQL Schema"**, then paste and run it in the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql).
3. **Automatic & On-Demand Sync**:
   - Work requests created or modified are automatically synced to the `work_requests` table.
   - You can trigger a complete batch synchronization at any time using the **"Sync All to Supabase"** button in the Integrations Hub.

---

## 🏃 Local Setup & Development

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun**
- *(Optional)* **Gemini API Key**: For natural language schedule explanations and regulatory audit notes.

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### Step 3: Start Development Server
```bash
npm run dev
```
The application will launch at `http://localhost:3000`.

### Step 4: Build for Production
```bash
npm run build
```
Starts the compiled CommonJS bundle via `npm start`.

---

## 👥 Role-Based Operational Access

The system provides tailored interfaces for different railway stakeholders:
1. **Track Supervisor (P.Way)**: Focused on track chainages, USFD flaw reports, tamping requirements, and gang safety buffers.
2. **Depot Engineer (OHE / S&T)**: Focused on 25kV power block permits, tower wagon allocations, and signal interlocking testing.
3. **Workshop Manager**: Monitors rolling stock overhauls (POH/IOH), wheel turning bays, and spare parts inventory.
4. **Section Traffic Controller**: Manages train timetable paths, punctuality impacts, non-traffic slots, and emergency caution orders.
5. **Senior Divisional Management**: High-level KPI dashboards, Capex projections, multi-departmental conflict resolution, and regulatory audits.

---

## 📜 Regulatory & Safety Standards Compliance
- **Indian Railways P.Way Manual (IRPWM)**: Compliance with track geometric tolerances, caution order speeds, and tamping frequencies.
- **Indian Railways AC Traction Manual (ACTM)**: Mandatory 25kV OHE power blocks for work within danger zones.
- **Factory & Labour Welfare Acts**: Strict 48-hour weekly working cap for track maintenance gangs.
