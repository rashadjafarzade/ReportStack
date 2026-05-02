from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.api import launches, test_items, logs, attachments, analyses, comments, defects, members, project_settings, dashboards, test_history, auth
from app.database import engine, Base
from app.services.storage import ensure_bucket

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ReportStack API",
    description="Test automation reporting and analytics platform",
    version="2.0.0",
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(launches.router)
app.include_router(test_items.router)
app.include_router(logs.router)
app.include_router(attachments.router)
app.include_router(analyses.router)
app.include_router(comments.router)
app.include_router(defects.router)
app.include_router(members.router)
app.include_router(project_settings.router)
app.include_router(dashboards.router)
app.include_router(test_history.router)
app.include_router(auth.router)


@app.get("/docs", include_in_schema=False)
async def custom_docs():
    return HTMLResponse("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ReportStack API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
body { margin:0; background:#f8fafc; }
.swagger-ui { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }

/* Top bar */
.swagger-ui .topbar {
    background: linear-gradient(135deg,#1e40af 0%,#0b2e7c 100%);
    padding:14px 24px; border-bottom:3px solid #3b82f6;
}
.swagger-ui .topbar .download-url-wrapper { display:none; }
.swagger-ui .topbar-wrapper .link {
    font-size:18px; font-weight:700; letter-spacing:-0.01em;
}
.swagger-ui .topbar-wrapper .link::before { content:"◆ "; color:#60a5fa; }
.swagger-ui .topbar-wrapper img[alt="Swagger UI"], .swagger-ui .topbar-wrapper .link img { display:none; }

/* Info */
.swagger-ui .info .title { color:#0f172a; font-weight:700; }
.swagger-ui .info { margin:30px 0; }
.swagger-ui .info .description p { color:#475569; font-size:14px; }

/* Wrapper */
.swagger-ui .wrapper { max-width:1200px; padding:0 24px; }

/* Operation blocks */
.swagger-ui .opblock {
    border-radius:8px; border:1px solid #e2e8f0;
    box-shadow:0 1px 3px rgba(0,0,0,0.04); margin-bottom:8px;
}
.swagger-ui .opblock .opblock-summary {
    border-radius:8px; padding:10px 16px;
}
.swagger-ui .opblock .opblock-summary-method {
    border-radius:6px; font-weight:600; font-size:12px;
    min-width:70px; padding:6px 12px; text-align:center;
}
.swagger-ui .opblock .opblock-summary-path { font-weight:500; }
.swagger-ui .opblock .opblock-summary-description { color:#64748b; font-size:13px; }

/* GET */
.swagger-ui .opblock.opblock-get { border-color:#dbeafe; background:#fafcff; }
.swagger-ui .opblock.opblock-get .opblock-summary-method { background:#1e40af; }
.swagger-ui .opblock.opblock-get .opblock-summary { border-color:#dbeafe; }

/* POST */
.swagger-ui .opblock.opblock-post { border-color:#d1fae5; background:#f8fdfb; }
.swagger-ui .opblock.opblock-post .opblock-summary-method { background:#059669; }
.swagger-ui .opblock.opblock-post .opblock-summary { border-color:#d1fae5; }

/* PUT */
.swagger-ui .opblock.opblock-put { border-color:#fde68a; background:#fffdf7; }
.swagger-ui .opblock.opblock-put .opblock-summary-method { background:#d97706; }
.swagger-ui .opblock.opblock-put .opblock-summary { border-color:#fde68a; }

/* DELETE */
.swagger-ui .opblock.opblock-delete { border-color:#fecaca; background:#fffbfb; }
.swagger-ui .opblock.opblock-delete .opblock-summary-method { background:#dc2626; }
.swagger-ui .opblock.opblock-delete .opblock-summary { border-color:#fecaca; }

/* Tag groups */
.swagger-ui .opblock-tag {
    font-size:15px; font-weight:600; color:#0f172a;
    border-bottom:2px solid #e2e8f0; padding:14px 0;
}
.swagger-ui .opblock-tag small { color:#64748b; font-size:12px; }

/* Models */
.swagger-ui section.models {
    border:1px solid #e2e8f0; border-radius:8px;
}
.swagger-ui section.models h4 { font-size:15px; font-weight:600; color:#0f172a; }
.swagger-ui .model-box { background:#f8fafc; border-radius:6px; }

/* Buttons */
.swagger-ui .btn.authorize {
    border-color:#1e40af; color:#1e40af;
    border-radius:6px; font-weight:600;
}
.swagger-ui .btn.authorize svg { fill:#1e40af; }
.swagger-ui .btn.execute {
    background:#1e40af; border-color:#1e40af;
    border-radius:6px; font-weight:600;
}
.swagger-ui .btn.execute:hover { background:#1e3a8a; }

/* Server / scheme */
.swagger-ui .scheme-container {
    background:#f1f5f9; border-radius:8px;
    box-shadow:none; border:1px solid #e2e8f0; padding:12px 20px;
}

/* Response */
.swagger-ui .responses-inner { border-radius:6px; }
.swagger-ui table tbody tr td { padding:10px 12px; }
.swagger-ui .response-col_status { font-weight:600; }

/* Try it out */
.swagger-ui .try-out__btn {
    border-color:#1e40af; color:#1e40af; border-radius:6px;
}

/* Parameter inputs */
.swagger-ui input[type=text], .swagger-ui textarea, .swagger-ui select {
    border-radius:6px; border:1px solid #e2e8f0;
    font-family:'Inter',sans-serif; font-size:13px;
}
.swagger-ui input[type=text]:focus, .swagger-ui textarea:focus {
    border-color:#1e40af; outline:none;
    box-shadow:0 0 0 3px rgba(30,64,175,0.1);
}

/* Scrollbar */
::-webkit-scrollbar { width:6px; height:6px; }
::-webkit-scrollbar-track { background:#f1f5f9; border-radius:3px; }
::-webkit-scrollbar-thumb { background:#94a3b8; border-radius:3px; }

/* Expand arrow */
.swagger-ui .expand-operation svg { fill:#64748b; }

/* Loading */
.swagger-ui .loading-container .loading::after {
    color:#1e40af; font-family:'Inter',sans-serif;
}
</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    docExpansion: 'list',
    defaultModelsExpandDepth: 0,
    filter: true,
    tryItOutEnabled: true,
});
</script>
</body>
</html>""")


@app.get("/redoc", include_in_schema=False)
async def custom_redoc():
    return HTMLResponse("""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>ReportStack API - ReDoc</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>body { margin:0; font-family:'Inter',sans-serif; }</style>
</head>
<body>
<redoc spec-url='/openapi.json'
    hide-download-button
    theme='{
        "colors":{"primary":{"main":"#1e40af"}},
        "typography":{"fontFamily":"Inter, sans-serif","headings":{"fontFamily":"Inter, sans-serif"}},
        "sidebar":{"backgroundColor":"#0f172a","textColor":"#94a3b8","activeTextColor":"#f1f5f9"}
    }'
></redoc>
<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>""")


@app.on_event("startup")
def on_startup():
    ensure_bucket()
    _start_retention_scheduler()


def _start_retention_scheduler():
    """Run data retention cleanup on startup and every 24 hours."""
    import threading
    from app.services.retention import run_retention_cleanup

    def _loop():
        import time
        while True:
            run_retention_cleanup()
            time.sleep(86400)  # 24 hours

    t = threading.Thread(target=_loop, daemon=True)
    t.start()


@app.get("/api/v1/health")
def health_check():
    from sqlalchemy import text
    from app.database import SessionLocal
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        db_ok = False
    status = "ok" if db_ok else "degraded"
    return {"status": status, "database": "connected" if db_ok else "unreachable"}
