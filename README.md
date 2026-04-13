# Retina — AI Chat Interface

A feature-rich Next.js frontend for interacting with AI models through the [Prism AI Gateway](../prism). Supports multi-provider chat, streaming responses, image generation, text-to-speech, speech-to-text, and includes a built-in admin dashboard for monitoring usage and costs.

## ✨ Features

### 💬 Chat

- **Multi-Provider Chat** — switch between OpenAI, Anthropic, Google, LM Studio, and more
- **WebSocket Streaming** — real-time token-by-token response rendering
- **Thinking / Reasoning** — display model thinking output with configurable effort levels
- **Vision** — attach images and documents (PDFs) to messages for multimodal models
- **Image Generation** — inline image generation with models like GPT Image and Gemini Image
- **Web Search** — toggle grounded web search for supported models, with source citations
- **Code Execution** — server-side code execution results rendered inline
- **Markdown Rendering** — full markdown with syntax highlighting (via `react-markdown` + `react-syntax-highlighter`)
- **System Prompts** — modal for creating, selecting, and managing reusable system instructions
- **Conversation History** — save, load, rename, and delete conversations (stored in Prism/MongoDB)
- **Message Editing** — edit, delete, or re-run individual messages
- **Auto-Title** — conversations are automatically titled from the first message

### 🗣️ Text-to-Speech

- **Multiple TTS Providers** — OpenAI, Google, ElevenLabs, and Inworld voices
- **Voice Selection** — per-provider voice picker with gender labels
- **Inline Audio Playback** — audio responses rendered with playback controls in chat
- **Cost Estimation** — per-request cost shown based on character/token count

### 🎤 Speech-to-Text

- **Audio Transcription** — attach audio files and transcribe with OpenAI Whisper or Google models
- **Multi-File Support** — transcribe multiple audio files in sequence

### ⚙️ Settings

- **Model Selection** — grouped by provider with pricing, context length, and arena scores
- **Generation Parameters** — temperature, max tokens, top-p, top-k, frequency/presence penalty, stop sequences
- **Tool Toggles** — enable/disable thinking, web search, code execution, and URL context per model
- **Inference Mode** — switch between async and streaming
- **Dark / Light Theme** — toggle with persistent preference

### 🛡️ Admin Dashboard (`/admin`)

Requires `ADMIN_SECRET` to be configured in `secrets.js`.

- **Overview** — total requests, tokens, cost, latency, and success rate
- **Request Logs** (`/admin/requests`) — paginated, filterable request history with full detail view
- **Conversations** (`/admin/conversations`) — browse all conversations across projects
- **Live Activity** (`/admin/live`) — real-time view of active conversations
- **LM Studio** (`/admin/lm-studio`) — load/unload local models remotely
- **Stats Breakdowns** — per-project, per-model, and per-endpoint analytics

## 📂 Directory Structure

```
retina/
├── public/                                  # Static assets
│   ├── pcm-processor.js                     # AudioWorklet for real-time PCM capture
│   ├── playback-processor.js                # AudioWorklet for PCM playback
│   └── *.svg, *.gif                         # Icons and animated assets
└── src/
    ├── app/                                 # Next.js App Router pages
    │   ├── layout.js                        # Root layout with ThemeProvider
    │   ├── globals.css                      # Global CSS variables and base styles
    │   ├── page.js                          # Home / chat page
    │   ├── conversations/                   # Conversation list and detail views
    │   ├── settings/                        # User settings page
    │   ├── models/                          # Model catalog browser
    │   ├── media/                           # Generated media gallery
    │   ├── text/                            # Plain text generation page
    │   ├── synthesis/                       # Synthesis session page
    │   ├── benchmarks/                      # Benchmark creation and history
    │   ├── workflows/                       # Visual workflow editor
    │   ├── vram-benchmark/                  # VRAM benchmark interface
    │   ├── coding-agent/                    # Coding agent chat interface
    │   └── admin/                           # Admin dashboard pages
    │       ├── page.js                      # Admin overview (stats, timeline)
    │       ├── requests/                    # Request log browser with filters
    │       ├── conversations/               # Cross-project conversation browser
    │       ├── traces/                      # Request trace viewer
    │       ├── tool-calls/                  # Tool call log viewer
    │       ├── tool-requests/               # Tool request analytics
    │       ├── models/                      # Model usage analytics
    │       ├── providers/                   # Provider usage analytics
    │       ├── media/                       # Admin media browser
    │       ├── text/                        # Admin text generation
    │       └── workflows/                   # Admin workflow browser
    ├── components/                          # Reusable React components (~100+)
    │   ├── ChatComponent.js                 # Main chat interface with message input
    │   ├── MessageList.js                   # Scrollable message feed
    │   ├── MarkdownContent.js               # Markdown renderer with syntax highlighting
    │   ├── NavigationSidebarComponent.js     # App-wide navigation sidebar
    │   ├── HistoryPanel.js                  # Conversation history sidebar
    │   ├── SettingsPanel.js                 # Chat settings (model, params, tools)
    │   ├── ModelPickerPopoverComponent.js   # Model selection popover with search
    │   ├── CostBadgeComponent.js            # Animated rolling cost display
    │   ├── WorkflowCanvas.js                # Visual node graph for workflows
    │   ├── BenchmarkComponent.js            # Benchmark runner and results
    │   ├── SynthesisComponent.js            # Multi-model synthesis interface
    │   ├── ToolCardComponent.js             # Tool call result card
    │   ├── ToolResultRenderers.js           # Specialized tool result renderers
    │   ├── DocumentViewer.js                # PDF and document inline viewer
    │   ├── DrawingCanvas.js                 # Drawing pad for image input
    │   ├── ThemeProvider.js                 # CSS theme (dark/light) manager
    │   └── ...                              # Many more UI primitives and composites
    ├── hooks/                               # Custom React hooks
    │   ├── useModelMemory.js                # Remembers last-used model per type
    │   ├── useProjectFilter.js              # Project filter state
    │   └── useToolToggles.js                # Tool enable/disable state
    ├── services/                            # API communication and business logic
    │   ├── PrismService.js                  # HTTP + WebSocket client for Prism API
    │   ├── SSEManager.js                    # Server-Sent Events connection manager
    │   ├── LiveSessionService.js            # Real-time session monitoring
    │   ├── AudioPlayerService.js            # Audio playback with queue management
    │   ├── StorageService.js                # localStorage persistence layer
    │   ├── ToolsApiService.js               # Client for the Tools API
    │   ├── IrisService.js                   # Iris integration service
    │   ├── WorkflowService.js               # Workflow CRUD client
    │   ├── WorkflowExecutor.js              # Client-side workflow execution engine
    │   └── serviceHeaders.js                # Shared auth/project headers
    ├── utils/                               # Utility helpers
    │   ├── utilities.js                     # General formatting and helpers
    │   ├── FunctionCallingUtilities.js       # Tool call formatting
    │   ├── benchmarkPresets.js              # Predefined benchmark configurations
    │   ├── datePresets.js                   # Date range presets for filters
    │   ├── requestDetailHelpers.js          # Request detail view formatters
    │   └── tableColumns.js                  # Column definitions for data tables
    ├── constants.js                         # App-wide constants and enums
    └── middleware.js                        # Next.js Edge middleware
```

## ⚙️ Prerequisites

- **Node.js** v20+
- **Prism AI Gateway** — running and accessible (see [Prism README](../prism/README.md))

## 🛠️ Tech Stack

| Dependency               | Purpose                          |
| ------------------------ | -------------------------------- |
| Next.js 16               | React framework with App Router  |
| React 19                 | UI library                       |
| react-markdown           | Markdown rendering               |
| react-syntax-highlighter | Code block syntax highlighting   |
| remark-gfm               | GitHub-flavored markdown support |
| lucide-react             | Icon library                     |
| luxon                    | Date/time formatting             |

## 🚀 Setup

### 1️⃣ Install dependencies

```bash
npm install
```

### 2️⃣ Configure secrets

Copy the example secrets file and fill in your values:

```bash
cp secrets.example.js config.example.js
cp config.example.js config.js
```

### 3️⃣ Environment Types

Edit `config.js` with your real values:

| Variable       | Required | Description                                                         |
| -------------- | -------- | ------------------------------------------------------------------- |
| `PRISM_URL`    | Yes      | URL of the Prism backend                                            |
| `PRISM_WS_URL` | Yes      | WebSocket URL of the Prism backend                                  |
| `PRISM_SECRET` | Yes      | Must match `GATEWAY_SECRET` in Prism's secrets                      |
| `ADMIN_SECRET` | No       | Must match `ADMIN_SECRET` in Prism — needed for the admin dashboard |

> **Note:** `secrets.js` is gitignored — never commit it.

### 4️⃣ Run the development server

```bash
npm run dev
```

Opens on [http://localhost:3000](http://localhost:3000).

## 📜 Scripts

```bash
npm run dev      # Start dev server (port 3000, with file polling for WSL)
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
npm run format   # Format with Prettier
```

## ☀️ Part of [Sun](https://github.com/rodrigo-barraza)

Retina is one frontend in the Sun ecosystem — a collection of composable backend services and frontends designed to be mixed and matched.
