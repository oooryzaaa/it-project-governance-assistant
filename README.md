# Asisten Tata Kelola Proyek TI

A vanilla JavaScript and Node.js application for planning and reviewing IT projects. It generates a Project Charter, deliverable-driven Work Breakdown Structure (WBS), detailed WBS-based Gantt schedule, contextual Risk Register, editable Cost Estimation, assumptions, and an indicative COBIT 2019 governance review.

## Features

- Template Mode produces deterministic project documents locally in the browser and works with `file://`.
- Optional Gemini AI Mode is accessed through the Express backend; failed or unavailable AI generation is labeled and falls back to Template Mode.
- Workspace modules include Overview, Project Charter, WBS, Gantt Chart, Risk Register, Cost Estimation, Assumptions, and COBIT 2019 Review.
- Gantt schedules show WBS hierarchy, dependencies, calendar dates (or relative weeks), and an explicit schedule buffer when available.
- Cost rows and contingency are editable. CSV exports use the current document values; Print All Documents includes generated modules.
- The application uses ordered classic scripts and has no frontend build step.

## Requirements and setup

- Node.js 18 or newer.
- npm.

Install dependencies and start the Express application:

```sh
npm install
npm start
```

Open <http://localhost:3000>. Run the automated tests with:

```sh
npm test
```

To use Template Mode without Node.js, open `index.html` directly in a browser (`file://`) or serve the project with a static HTTP server. Template Mode does not call the backend. Its layout uses Tailwind CSS and Inter from CDNs, so appearance may fall back if offline. AI Mode requires the Express API.

## Optional Gemini configuration

AI Mode is optional. To enable it, create a local `.env` file from `.env.example`, then set:

```dotenv
GEMINI_API_KEY=your_key
GEMINI_MODEL=your_model
PORT=3000
```

Keep `.env` local, do not commit it, and never put the API key in frontend code. The server loads environment configuration at startup and does not return credentials in API responses. If configuration is missing or the provider call fails, the application reports the Template fallback rather than treating it as an AI result.

Live Gemini connectivity has not been tested as part of this project validation.

## Application layout

```text
.
├── app.js
├── cobit-data.js
├── css/
│   ├── app.css
│   └── gantt.css
├── index.html
├── js/
│   ├── core/
│   │   ├── project-store.js
│   │   └── utils.js
│   └── features/
│       ├── assumptions-ui.js
│       ├── ai-normalization.js
│       ├── cobit.js
│       ├── cost-ui.js
│       ├── cost.js
│       ├── document-renderers.js
│       ├── export-ui.js
│       ├── gantt-schedule.js
│       ├── gantt-ui.js
│       ├── governance-ui.js
│       ├── risks.js
│       ├── status-ui.js
│       ├── template.js
│       └── workspace-ui.js
├── server/
│   ├── gemini-service.js
│   ├── generation.js
│   └── public-assets.js
├── server.js
└── test/
    ├── app-regression.test.js
    ├── core-store.test.js
    ├── helpers/
    │   └── app-harness.js
    └── server-validation.test.js
```

The browser loads the feature files as ordered classic scripts. `js/core/project-store.js` is the canonical owner of project/document state. `app.js` bootstraps generation and coordinates features. The CommonJS backend keeps request validation, prompt/response handling, Gemini calls, and the public asset allowlist in small server modules. `cobit-data.js` supports both browser and CommonJS use.

## Generated documents and limitations

- WBS items and Gantt dates are generated planning estimates, not an approved baseline. Gantt activity dates, dependencies, and buffer should be reviewed and approved by the project team.
- Cost figures are estimates and should be validated against actual rates and procurement assumptions. Budget Health compares the calculated estimate to a parseable budget threshold; ambiguous budget text is not guessed.
- COBIT mappings, explanations, KPIs, and scores are indicative planning aids only. They are not an audit, maturity assessment, or official compliance determination.
- AI output can be incomplete or inaccurate and requires human review. No live Gemini API request is made by the automated test suite.
- Browser print-to-PDF uses the browser's print dialog. CSV download behavior depends on browser permissions and settings.
- The local COBIT objective data is loaded from `cobit-data.js`; use only appropriately licensed data when populating or redistributing it.

## Security notes

- The Gemini key remains server-side and is not sent to the browser.
- The API validates request types, sizes, required values, and project bounds before invoking the provider.
- Static HTTP access is limited to the application entry point and explicitly approved frontend asset paths; backend modules, tests, references, dependencies, and environment files are not served.
- User-facing renderers should escape untrusted text. CSV string values that begin like spreadsheet formulas are prefixed to reduce formula execution risk.
