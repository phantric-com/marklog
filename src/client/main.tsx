import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { api } from "./api.js";
import type {
  DiffBlock,
  DiffLineType,
  DiffResponse,
  DocumentRecord,
  NetworkInfo,
  NetworkUrl,
  Project,
  Revision,
  WorkspaceStatus
} from "../shared/types.js";
import "./styles.css";

type QrTarget = {
  title: string;
  url: string;
};

type AppRoute =
  | { type: "dashboard" }
  | { type: "projects" }
  | { type: "project"; projectId: string }
  | { type: "settings" };

type SourceTreeFolder = {
  name: string;
  path: string;
  document: DocumentRecord | null;
  folders: SourceTreeFolder[];
};

type Locale = "ko" | "en";
type ThemeMode = "light" | "dark";
type DiffMode = "unified" | "split";
type Translate = (key: TranslationKey) => string;

const englishCopy = {
  appName: "Marklog Local",
  dashboard: "Dashboard",
  projects: "Projects",
  project: "Project",
  settings: "Settings",
  workspace: "Workspace",
  workspacePath: "Workspace path",
  path: "Path",
  database: "Database",
  runtime: "Runtime",
  bind: "Bind",
  unknown: "Unknown",
  refreshStatus: "Refresh status",
  interface: "Interface",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  language: "Language",
  korean: "Korean",
  english: "English",
  shareQr: "Share QR",
  openMarklog: "Open Marklog",
  primaryNav: "Primary",
  browseArchives: "Browse local planning archives",
  wifiShare: "Wi-Fi Share",
  wifiOn: "On",
  localOnly: "Local",
  runStartLanToShare: "Run start:lan to share",
  ready: "Ready",
  setup: "Setup",
  recentProjects: "Recent Projects",
  open: "Open",
  noDescription: "No description",
  noProjects: "No projects have been published by AI yet.",
  projectNotFound: "Project not found.",
  documents: "Documents",
  noDocuments: "AI has not published any document packages yet.",
  openPage: "Open page",
  pageQr: "Page QR",
  latest: "Latest",
  latestLower: "latest",
  noVisibleRevision: "AI has not published a visible revision for this document package yet.",
  selectDocument: "Select a document package to view.",
  history: "History",
  noRevisions: "No revisions published yet.",
  loading: "Loading Marklog...",
  projectRoot: "project",
  folder: "folder",
  initializing: "Initializing...",
  initializeWorkspace: "Initialize workspace",
  close: "Close",
  qrAltPrefix: "QR code for",
  wifiSharing: "Wi-Fi Sharing",
  wifiSharingOn: "People on the same Wi-Fi can open a LAN URL below while this server is running.",
  wifiSharingOffBefore: "Restart with ",
  wifiSharingOffBetween: " or ",
  wifiSharingOffAfter: " to accept same Wi-Fi connections.",
  currentBrowserUrl: "Current browser URL",
  documentPackage: "Document",
  compare: "Compare",
  compareRevisions: "Compare revisions",
  baseRevision: "Base revision",
  targetRevision: "Target revision",
  diff: "Diff",
  viewMode: "View mode",
  unified: "Unified",
  sideBySide: "Side by side",
  closeDiff: "Close diff",
  loadingDiff: "Comparing...",
  selectDifferentRevisions: "Select two different revisions.",
  needsTwoRevisions: "At least two revisions are required for diff.",
  noChanges: "No line changes.",
  addedLines: "added",
  removedLines: "removed",
  base: "Base",
  target: "Target",
  line: "Line"
} as const;

type TranslationKey = keyof typeof englishCopy;

const koreanCopy: Record<TranslationKey, string> = {
  appName: "Marklog Local",
  dashboard: "대시보드",
  projects: "프로젝트",
  project: "프로젝트",
  settings: "설정",
  workspace: "작업공간",
  workspacePath: "작업공간 경로",
  path: "경로",
  database: "데이터베이스",
  runtime: "런타임",
  bind: "바인드",
  unknown: "알 수 없음",
  refreshStatus: "상태 새로고침",
  interface: "인터페이스",
  theme: "테마",
  light: "라이트",
  dark: "다크",
  language: "언어",
  korean: "한국어",
  english: "English",
  shareQr: "공유 QR",
  openMarklog: "Marklog 열기",
  primaryNav: "주요 메뉴",
  browseArchives: "로컬 기획 아카이브 보기",
  wifiShare: "Wi-Fi 공유",
  wifiOn: "켜짐",
  localOnly: "로컬",
  runStartLanToShare: "공유하려면 start:lan 실행",
  ready: "준비됨",
  setup: "설정 필요",
  recentProjects: "최근 프로젝트",
  open: "열기",
  noDescription: "설명 없음",
  noProjects: "아직 AI가 발행한 프로젝트가 없습니다.",
  projectNotFound: "프로젝트를 찾을 수 없습니다.",
  documents: "문서",
  noDocuments: "아직 AI가 발행한 문서 패키지가 없습니다.",
  openPage: "페이지 열기",
  pageQr: "페이지 QR",
  latest: "최신",
  latestLower: "최신",
  noVisibleRevision: "아직 이 문서 패키지에 표시할 리비전이 없습니다.",
  selectDocument: "볼 문서 패키지를 선택하세요.",
  history: "히스토리",
  noRevisions: "아직 발행된 리비전이 없습니다.",
  loading: "Marklog 불러오는 중...",
  projectRoot: "프로젝트",
  folder: "폴더",
  initializing: "초기화 중...",
  initializeWorkspace: "작업공간 초기화",
  close: "닫기",
  qrAltPrefix: "QR 코드",
  wifiSharing: "Wi-Fi 공유",
  wifiSharingOn: "같은 Wi-Fi에 있는 사람이 아래 LAN URL로 접속할 수 있습니다.",
  wifiSharingOffBefore: "같은 Wi-Fi 접속을 허용하려면 ",
  wifiSharingOffBetween: " 또는 ",
  wifiSharingOffAfter: "로 다시 시작하세요.",
  currentBrowserUrl: "현재 브라우저 URL",
  documentPackage: "문서",
  compare: "비교",
  compareRevisions: "리비전 비교",
  baseRevision: "기준 리비전",
  targetRevision: "대상 리비전",
  diff: "Diff",
  viewMode: "보기 방식",
  unified: "통합",
  sideBySide: "양쪽 비교",
  closeDiff: "Diff 닫기",
  loadingDiff: "비교 중...",
  selectDifferentRevisions: "서로 다른 리비전 두 개를 선택하세요.",
  needsTwoRevisions: "Diff를 보려면 리비전이 최소 두 개 필요합니다.",
  noChanges: "라인 변경이 없습니다.",
  addedLines: "추가",
  removedLines: "삭제",
  base: "기준",
  target: "대상",
  line: "라인"
};

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: englishCopy,
  ko: koreanCopy
};

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceStatus | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [selectedRevisionLabel, setSelectedRevisionLabel] = useState<string | null>(null);
  const [diffBaseRevisionId, setDiffBaseRevisionId] = useState("");
  const [diffTargetRevisionId, setDiffTargetRevisionId] = useState("");
  const [diffMode, setDiffMode] = useState<DiffMode>("unified");
  const [diffResult, setDiffResult] = useState<DiffResponse | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [pathname, setPathname] = useState(window.location.pathname);
  const [error, setError] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);
  const [locale, setLocale] = useState<Locale>(() => initialLocale());
  const [theme, setTheme] = useState<ThemeMode>(() => initialTheme());

  const appRoute = useMemo(() => parseAppRoute(pathname), [pathname]);
  const t = useMemo<Translate>(() => (key) => translations[locale][key], [locale]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const sourceTree = useMemo(() => buildSourceTree(documents), [documents]);

  const loadWorkspace = useCallback(async () => {
    const [status, nextNetworkInfo] = await Promise.all([api.workspaceStatus(), api.networkInfo()]);
    setWorkspace(status);
    setNetworkInfo(nextNetworkInfo);
    if (status.initialized) {
      const nextProjects = await api.listProjects();
      setProjects(nextProjects);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (appRoute.type === "project") {
      setSelectedProjectId(appRoute.projectId);
      return;
    }
    if (appRoute.type === "dashboard" || appRoute.type === "projects") {
      setSelectedProjectId(null);
    }
  }, [appRoute]);

  const loadDocuments = useCallback(async (projectId: string) => {
    const nextDocuments = await api.listDocuments(projectId);
    setDocuments(nextDocuments);
    setSelectedDocument((current) => {
      const stillExists = current && nextDocuments.some((document) => document.id === current.id);
      return stillExists ? current : nextDocuments[0] ?? null;
    });
  }, []);

  const loadRevisions = useCallback(async (documentId: string) => {
    const nextRevisions = await api.listRevisions(documentId);
    setRevisions(nextRevisions);
    setSelectedRevisionLabel((current) =>
      current && nextRevisions.some((revision) => revision.versionLabel === current) ? current : null
    );
  }, []);

  useEffect(() => {
    loadWorkspace().catch((nextError: unknown) => setError(toMessage(nextError)));
  }, [loadWorkspace]);

  useEffect(() => {
    document.documentElement.lang = locale;
    writePreference("marklog.locale", locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePreference("marklog.theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedProjectId) {
      setDocuments([]);
      setSelectedDocument(null);
      return;
    }
    loadDocuments(selectedProjectId).catch((nextError: unknown) => setError(toMessage(nextError)));
  }, [loadDocuments, selectedProjectId]);

  useEffect(() => {
    if (!selectedDocument) {
      setRevisions([]);
      setSelectedRevisionLabel(null);
      return;
    }
    loadRevisions(selectedDocument.id).catch((nextError: unknown) => setError(toMessage(nextError)));
  }, [loadRevisions, selectedDocument]);

  useEffect(() => {
    setDiffResult(null);
    setDiffError(null);
    setDiffBaseRevisionId(revisions[1]?.id ?? revisions[0]?.id ?? "");
    setDiffTargetRevisionId(revisions[0]?.id ?? "");
  }, [selectedDocument?.id, revisions]);

  function navigateTo(nextPathname: string) {
    window.history.pushState({}, "", nextPathname);
    setPathname(window.location.pathname);
  }

  function routeTitle(): string {
    if (appRoute.type === "settings") return t("settings");
    if (appRoute.type === "projects") return t("projects");
    if (appRoute.type === "project") return selectedProject?.name ?? t("project");
    return t("dashboard");
  }

  function renderDashboard() {
    return (
      <main className="dashboard-view">
        <section className="dashboard-grid">
          <button className="dashboard-tile" onClick={() => navigateTo("/projects")}>
            <span>{t("projects")}</span>
            <strong>{projects.length}</strong>
            <small>{t("browseArchives")}</small>
          </button>
          <button
            className="dashboard-tile"
            onClick={() => setQrTarget({ title: t("openMarklog"), url: shareUrlForPath("/", networkInfo) })}
          >
            <span>{t("wifiShare")}</span>
            <strong>{networkInfo?.lanAvailable ? t("wifiOn") : t("localOnly")}</strong>
            <small>{networkInfo?.urls.find((entry) => entry.kind === "lan")?.url ?? t("runStartLanToShare")}</small>
          </button>
          <button className="dashboard-tile" onClick={() => navigateTo("/settings")}>
            <span>{t("workspace")}</span>
            <strong>{workspace?.initialized ? t("ready") : t("setup")}</strong>
            <small>{workspace?.workspacePath}</small>
          </button>
        </section>

        <section className="dashboard-section">
          <div className="section-header">
            <h2>{t("recentProjects")}</h2>
            <button onClick={() => navigateTo("/projects")}>{t("open")}</button>
          </div>
          <div className="project-card-grid">
            {projects.map((project) => (
              <button className="project-card" key={project.id} onClick={() => navigateTo(`/projects/${project.id}`)}>
                <strong>{project.name}</strong>
                <span>{project.description || t("noDescription")}</span>
                <small>{formatDate(project.updatedAt, locale)}</small>
              </button>
            ))}
            {projects.length === 0 && <div className="empty-state">{t("noProjects")}</div>}
          </div>
        </section>
      </main>
    );
  }

  function renderProjectManagement() {
    return (
      <main className="projects-view">
        <section className="dashboard-section">
          <h2>{t("projects")}</h2>
          <div className="project-table">
            {projects.map((project) => (
              <div className="project-table-row" key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <small>{project.description || project.id}</small>
                </div>
                <small>{formatDate(project.updatedAt, locale)}</small>
                <button onClick={() => navigateTo(`/projects/${project.id}`)}>{t("open")}</button>
              </div>
            ))}
            {projects.length === 0 && <div className="empty-state">{t("noProjects")}</div>}
          </div>
        </section>
      </main>
    );
  }

  async function compareRevisions() {
    if (!diffBaseRevisionId || !diffTargetRevisionId || diffBaseRevisionId === diffTargetRevisionId) {
      setDiffError(t("selectDifferentRevisions"));
      return;
    }
    setDiffBusy(true);
    setDiffError(null);
    try {
      setDiffResult(await api.diff(diffBaseRevisionId, diffTargetRevisionId));
    } catch (nextError) {
      setDiffError(toMessage(nextError));
    } finally {
      setDiffBusy(false);
    }
  }

  function renderProjectViewer() {
    if (!selectedProject) {
      return <main className="dashboard-view"><div className="empty-state">{t("projectNotFound")}</div></main>;
    }

    const viewerHref =
      selectedDocument && revisions.length > 0
        ? revisionPageHref(selectedProject.id, selectedDocument.routePath, selectedRevisionLabel)
        : null;
    const viewerShareUrl = viewerHref ? shareUrlForPath(viewerHref, networkInfo) : null;

    return (
      <main className="project-workbench">
        <aside className="sidebar document-pane">
          <section className="panel-section">
            <h2>{t("documents")}</h2>
            <SourceTreeView
              root={sourceTree}
              projectName={selectedProject.name}
              selectedDocumentId={selectedDocument?.id ?? null}
              onSelectDocument={(document) => {
                setSelectedDocument(document);
                setSelectedRevisionLabel(null);
              }}
              t={t}
            />
            {documents.length === 0 && <div className="tree-empty">{t("noDocuments")}</div>}
          </section>
        </aside>

        <section className="viewer-pane">
          {selectedDocument ? (
            <>
              <div className="viewer-header">
                <div>
                  <h2>{selectedDocument.title}</h2>
                  <span className="viewer-path">
                    /{selectedDocument.routePath}/ · {selectedRevisionLabel ?? t("latestLower")}
                  </span>
                </div>
                <div className="viewer-actions">
                  {viewerHref && (
                    <a href={viewerHref} target="_blank" rel="noreferrer">
                      {t("openPage")}
                    </a>
                  )}
                  {viewerShareUrl && (
                    <button
                      onClick={() =>
                        setQrTarget({
                          title: `${selectedDocument.title} ${selectedRevisionLabel ?? t("latestLower")}`,
                          url: viewerShareUrl
                        })
                      }
                    >
                      {t("pageQr")}
                    </button>
                  )}
                </div>
              </div>

              {viewerHref ? (
                <iframe className="document-frame" title={selectedDocument.title} src={viewerHref} />
              ) : (
                <div className="empty-state">{t("noVisibleRevision")}</div>
              )}
            </>
          ) : (
            <div className="empty-state">{t("selectDocument")}</div>
          )}
        </section>

        <aside className="history-pane">
          <section className="panel-section">
            <h2>{t("history")}</h2>
            <div className="revision-list">
              {selectedDocument && revisions.length > 0 && (
                <div className="revision-row">
                  <button className={selectedRevisionLabel === null ? "active" : ""} onClick={() => setSelectedRevisionLabel(null)}>
                    <strong>{t("latest")}</strong>
                    <span>{revisions[0]?.versionLabel ?? ""}</span>
                  </button>
                </div>
              )}
              {revisions.map((revision) => (
                <div className="revision-row" key={revision.id}>
                  <button
                    className={selectedRevisionLabel === revision.versionLabel ? "active" : ""}
                    onClick={() => setSelectedRevisionLabel(revision.versionLabel)}
                  >
                    <strong>{revision.versionLabel}</strong>
                    <span>{shortHash(revision.commitHash)}</span>
                  </button>
                  <small>{formatDate(revision.createdAt, locale)}</small>
                </div>
              ))}
              {selectedDocument && revisions.length === 0 && <div className="tree-empty">{t("noRevisions")}</div>}
            </div>
          </section>
          <DiffComparePanel
            revisions={revisions}
            baseRevisionId={diffBaseRevisionId}
            targetRevisionId={diffTargetRevisionId}
            busy={diffBusy}
            error={diffError}
            onBaseChange={setDiffBaseRevisionId}
            onTargetChange={setDiffTargetRevisionId}
            onCompare={compareRevisions}
            t={t}
          />
        </aside>
      </main>
    );
  }

  if (!workspace) {
    return <div className="boot">{t("loading")}</div>;
  }

  if (!workspace.initialized) {
    return (
      <WorkspaceSetup
        workspace={workspace}
        onReady={setWorkspaceAndLoad}
        error={error}
        locale={locale}
        theme={theme}
        onLocaleChange={setLocale}
        onThemeChange={setTheme}
        t={t}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t("appName")}</p>
          <h1>{routeTitle()}</h1>
        </div>
        <nav className="top-actions" aria-label={t("primaryNav")}>
          <button onClick={() => setQrTarget({ title: t("openMarklog"), url: shareUrlForPath("/", networkInfo) })}>
            {t("shareQr")}
          </button>
          <button className={appRoute.type === "dashboard" ? "active" : ""} onClick={() => navigateTo("/")}>
            {t("dashboard")}
          </button>
          <button className={appRoute.type === "projects" ? "active" : ""} onClick={() => navigateTo("/projects")}>
            {t("projects")}
          </button>
          <button className={appRoute.type === "settings" ? "active" : ""} onClick={() => navigateTo("/settings")}>
            {t("settings")}
          </button>
        </nav>
      </header>

      {error && (
        <div className="notice" role="alert">
          {error}
        </div>
      )}

      {appRoute.type === "settings" && (
        <SettingsView
          workspace={workspace}
          networkInfo={networkInfo}
          locale={locale}
          theme={theme}
          onLocaleChange={setLocale}
          onThemeChange={setTheme}
          onRefresh={loadWorkspace}
          t={t}
        />
      )}
      {appRoute.type === "dashboard" && renderDashboard()}
      {appRoute.type === "projects" && renderProjectManagement()}
      {appRoute.type === "project" && renderProjectViewer()}
      {qrTarget && <QrDialog target={qrTarget} onClose={() => setQrTarget(null)} t={t} />}
      {diffResult && (
        <DiffDialog
          diff={diffResult}
          mode={diffMode}
          onModeChange={setDiffMode}
          onClose={() => setDiffResult(null)}
          t={t}
        />
      )}
    </div>
  );

  async function setWorkspaceAndLoad(status: WorkspaceStatus) {
    setWorkspace(status);
    setNetworkInfo(await api.networkInfo());
    if (status.initialized) {
      const nextProjects = await api.listProjects();
      setProjects(nextProjects);
    }
  }
}

function SourceTreeView({
  root,
  projectName,
  selectedDocumentId,
  onSelectDocument,
  t
}: {
  root: SourceTreeFolder;
  projectName: string;
  selectedDocumentId: string | null;
  onSelectDocument: (document: DocumentRecord) => void;
  t: Translate;
}) {
  return (
    <div className="source-tree" role="tree">
      <div className="tree-row root-row">
        <span className="tree-root-kind">{t("projectRoot")}</span>
        <span className="tree-package-label">{projectName}</span>
      </div>
      {root.folders.map((folder) => (
        <SourceTreeFolderView
          key={folder.path}
          folder={folder}
          depth={0}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={onSelectDocument}
          t={t}
        />
      ))}
    </div>
  );
}

function SourceTreeFolderView({
  folder,
  depth,
  selectedDocumentId,
  onSelectDocument,
  t
}: {
  folder: SourceTreeFolder;
  depth: number;
  selectedDocumentId: string | null;
  onSelectDocument: (document: DocumentRecord) => void;
  t: Translate;
}) {
  const selected = folder.document?.id === selectedDocumentId;
  const label = folder.document?.title || displayRouteSegment(folder.name);
  return (
    <div className={`tree-folder ${selected ? "selected" : ""}`}>
      {folder.document ? (
        <button
          className="tree-row tree-doc-button"
          title={`/${folder.path}/`}
          style={{ paddingLeft: treeIndent(depth) }}
          onClick={() => onSelectDocument(folder.document!)}
        >
          <span className="tree-package-label">{label}</span>
          <span className="tree-document-kind">{t("documentPackage")}</span>
        </button>
      ) : (
        <div className="tree-row tree-doc-missing" style={{ paddingLeft: treeIndent(depth) }}>
          <span className="tree-package-label">{displayRouteSegment(folder.name)}</span>
          <span className="tree-document-kind">{t("folder")}</span>
        </div>
      )}
      {folder.folders.map((child) => (
        <SourceTreeFolderView
          key={child.path}
          folder={child}
          depth={depth + 1}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={onSelectDocument}
          t={t}
        />
      ))}
    </div>
  );
}

function buildSourceTree(documents: DocumentRecord[]): SourceTreeFolder {
  const root: MutableSourceTreeFolder = {
    name: "project",
    path: "",
    document: null,
    folders: new Map(),
  };

  for (const document of [...documents].sort((left, right) => left.routePath.localeCompare(right.routePath))) {
    const segments = document.routePath.split("/").filter(Boolean);
    let current = root;
    for (const segment of segments) {
      const childPath = current.path ? `${current.path}/${segment}` : segment;
      let child = current.folders.get(segment);
      if (!child) {
        child = {
          name: segment,
          path: childPath,
          document: null,
          folders: new Map(),
        };
        current.folders.set(segment, child);
      }
      current = child;
    }
    current.document = document;
  }

  return freezeSourceTree(root);
}

type MutableSourceTreeFolder = {
  name: string;
  path: string;
  document: DocumentRecord | null;
  folders: Map<string, MutableSourceTreeFolder>;
};

function freezeSourceTree(folder: MutableSourceTreeFolder): SourceTreeFolder {
  return {
    name: folder.name,
    path: folder.path,
    document: folder.document,
    folders: [...folder.folders.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(freezeSourceTree)
  };
}

function treeIndent(depth: number): string {
  return `${depth * 16 + 8}px`;
}

function displayRouteSegment(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function WorkspaceSetup({
  workspace,
  onReady,
  error,
  locale,
  theme,
  onLocaleChange,
  onThemeChange,
  t
}: {
  workspace: WorkspaceStatus;
  onReady: (workspace: WorkspaceStatus) => void;
  error: string | null;
  locale: Locale;
  theme: ThemeMode;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemeMode) => void;
  t: Translate;
}) {
  const [path, setPath] = useState(workspace.suggestedWorkspacePath);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function initialize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      onReady(await api.initWorkspace(path));
    } catch (nextError) {
      setLocalError(toMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="setup-screen">
      <section className="setup-panel">
        <p className="eyebrow">{t("appName")}</p>
        <h1>{t("workspace")}</h1>
        <PreferenceControls
          locale={locale}
          theme={theme}
          onLocaleChange={onLocaleChange}
          onThemeChange={onThemeChange}
          t={t}
          compact
        />
        {(error || localError) && <div className="notice">{error || localError}</div>}
        <form onSubmit={initialize}>
          <label htmlFor="workspace-path">{t("workspacePath")}</label>
          <input id="workspace-path" value={path} onChange={(event) => setPath(event.target.value)} />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? t("initializing") : t("initializeWorkspace")}
          </button>
        </form>
        <dl>
          <div>
            <dt>Git</dt>
            <dd>{workspace.git.available ? workspace.git.version : workspace.git.error}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

function QrDialog({ target, onClose, t }: { target: QrTarget; onClose: () => void; t: Translate }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-title" onClick={(event) => event.stopPropagation()}>
        <div className="qr-header">
          <div>
            <p className="eyebrow">{t("wifiShare")}</p>
            <h2 id="qr-title">{target.title}</h2>
          </div>
          <button onClick={onClose}>{t("close")}</button>
        </div>
        <img className="qr-image" src={`/api/qr.svg?url=${encodeURIComponent(target.url)}`} alt={`${t("qrAltPrefix")} ${target.url}`} />
        <input className="qr-url" readOnly value={target.url} onFocus={(event) => event.currentTarget.select()} />
      </section>
    </div>
  );
}

function DiffComparePanel({
  revisions,
  baseRevisionId,
  targetRevisionId,
  busy,
  error,
  onBaseChange,
  onTargetChange,
  onCompare,
  t
}: {
  revisions: Revision[];
  baseRevisionId: string;
  targetRevisionId: string;
  busy: boolean;
  error: string | null;
  onBaseChange: (revisionId: string) => void;
  onTargetChange: (revisionId: string) => void;
  onCompare: () => void;
  t: Translate;
}) {
  const canCompare = revisions.length >= 2 && baseRevisionId !== targetRevisionId && !busy;

  return (
    <section className="panel-section diff-panel">
      <h2>{t("compareRevisions")}</h2>
      {revisions.length < 2 ? (
        <div className="tree-empty">{t("needsTwoRevisions")}</div>
      ) : (
        <form
          className="diff-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCompare();
          }}
        >
          <label>
            <span>{t("baseRevision")}</span>
            <select value={baseRevisionId} onChange={(event) => onBaseChange(event.target.value)}>
              {revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  {revision.versionLabel} · {shortHash(revision.commitHash)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("targetRevision")}</span>
            <select value={targetRevisionId} onChange={(event) => onTargetChange(event.target.value)}>
              {revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  {revision.versionLabel} · {shortHash(revision.commitHash)}
                </option>
              ))}
            </select>
          </label>
          {error && <div className="diff-error">{error}</div>}
          <button className="primary" type="submit" disabled={!canCompare}>
            {busy ? t("loadingDiff") : t("compare")}
          </button>
        </form>
      )}
    </section>
  );
}

function DiffDialog({
  diff,
  mode,
  onModeChange,
  onClose,
  t
}: {
  diff: DiffResponse;
  mode: DiffMode;
  onModeChange: (mode: DiffMode) => void;
  onClose: () => void;
  t: Translate;
}) {
  const stats = diffStats(diff.blocks);
  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <div className="modal-backdrop diff-backdrop" role="presentation" onClick={onClose}>
      <section className="diff-dialog" role="dialog" aria-modal="true" aria-labelledby="diff-title" onClick={(event) => event.stopPropagation()}>
        <div className="diff-header">
          <div>
            <p className="eyebrow">{t("diff")}</p>
            <h2 id="diff-title">
              {diff.baseRevision.versionLabel} {"->"} {diff.targetRevision.versionLabel}
            </h2>
            <div className="diff-summary">
              <span className="diff-chip removed">-{stats.removed} {t("removedLines")}</span>
              <span className="diff-chip added">+{stats.added} {t("addedLines")}</span>
            </div>
          </div>
          <div className="diff-header-actions">
            <div className="segmented-control diff-mode-control" role="group" aria-label={t("viewMode")}>
              <button className={mode === "unified" ? "active" : ""} type="button" onClick={() => onModeChange("unified")}>
                {t("unified")}
              </button>
              <button className={mode === "split" ? "active" : ""} type="button" onClick={() => onModeChange("split")}>
                {t("sideBySide")}
              </button>
            </div>
            <button onClick={onClose}>{t("closeDiff")}</button>
          </div>
        </div>

        {hasChanges ? (
          mode === "unified" ? (
            <UnifiedDiffView blocks={diff.blocks} t={t} />
          ) : (
            <SplitDiffView blocks={diff.blocks} t={t} />
          )
        ) : (
          <div className="empty-state diff-empty">{t("noChanges")}</div>
        )}
      </section>
    </div>
  );
}

function UnifiedDiffView({ blocks, t }: { blocks: DiffBlock[]; t: Translate }) {
  return (
    <div className="diff-code unified-diff" role="table" aria-label={t("unified")}>
      {buildUnifiedDiffLines(blocks).map((line, index) => (
        <div className={`diff-line ${diffClass(line.type)}`} role="row" key={`${index}-${line.type}`}>
          <span className="diff-sign">{diffSign(line.type)}</span>
          <span className="diff-line-number">{line.baseLine ?? ""}</span>
          <span className="diff-line-number">{line.targetLine ?? ""}</span>
          <code>{line.text || " "}</code>
        </div>
      ))}
    </div>
  );
}

function SplitDiffView({ blocks, t }: { blocks: DiffBlock[]; t: Translate }) {
  return (
    <div className="diff-code split-diff" role="table" aria-label={t("sideBySide")}>
      <div className="split-diff-heading" role="row">
        <span>{t("base")}</span>
        <span>{t("target")}</span>
      </div>
      {buildSplitDiffRows(blocks).map((row, index) => (
        <div className="split-diff-row" role="row" key={index}>
          <DiffSideCell side={row.left} />
          <DiffSideCell side={row.right} />
        </div>
      ))}
    </div>
  );
}

function DiffSideCell({ side }: { side: SplitDiffSide | null }) {
  return (
    <div className={`split-diff-cell ${side ? diffClass(side.type) : "empty"}`}>
      <span className="diff-line-number">{side?.line ?? ""}</span>
      <code>{side?.text || " "}</code>
    </div>
  );
}

function SettingsView({
  workspace,
  networkInfo,
  locale,
  theme,
  onLocaleChange,
  onThemeChange,
  onRefresh,
  t
}: {
  workspace: WorkspaceStatus;
  networkInfo: NetworkInfo | null;
  locale: Locale;
  theme: ThemeMode;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onRefresh: () => Promise<void>;
  t: Translate;
}) {
  return (
    <main className="settings-view">
      <section className="settings-grid">
        <div>
          <h2>{t("workspace")}</h2>
          <dl>
            <div>
              <dt>{t("path")}</dt>
              <dd>{workspace.workspacePath}</dd>
            </div>
            <div>
              <dt>{t("database")}</dt>
              <dd>{workspace.databasePath}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h2>{t("runtime")}</h2>
          <dl>
            <div>
              <dt>Git</dt>
              <dd>{workspace.git.available ? workspace.git.version : workspace.git.error}</dd>
            </div>
            <div>
              <dt>{t("bind")}</dt>
              <dd>{networkInfo ? `${networkInfo.bindHost}:${networkInfo.port}` : t("unknown")}</dd>
            </div>
          </dl>
          <div className="settings-card-actions">
            <button onClick={onRefresh}>{t("refreshStatus")}</button>
          </div>
        </div>
        <div className="settings-wide">
          <h2>{t("interface")}</h2>
          <PreferenceControls
            locale={locale}
            theme={theme}
            onLocaleChange={onLocaleChange}
            onThemeChange={onThemeChange}
            t={t}
          />
        </div>
        <div className="settings-wide">
          <h2>{t("wifiSharing")}</h2>
          {networkInfo?.lanAvailable ? (
            <p className="settings-note">{t("wifiSharingOn")}</p>
          ) : (
            <p className="settings-note">
              {t("wifiSharingOffBefore")}
              <code>pnpm start:lan</code>
              {t("wifiSharingOffBetween")}
              <code>pnpm dev:lan</code>
              {t("wifiSharingOffAfter")}
            </p>
          )}
          <div className="share-url-list">
            {(networkInfo?.urls ?? []).map((entry) => (
              <div className={`share-url-row ${entry.kind}`} key={`${entry.kind}-${entry.url}`}>
                <div>
                  <strong>{networkLabel(entry, t)}</strong>
                  <small>{entry.address}</small>
                </div>
                <a href={entry.url} target="_blank" rel="noreferrer">
                  {entry.url}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function PreferenceControls({
  locale,
  theme,
  onLocaleChange,
  onThemeChange,
  t,
  compact = false
}: {
  locale: Locale;
  theme: ThemeMode;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemeMode) => void;
  t: Translate;
  compact?: boolean;
}) {
  return (
    <div className={`preference-grid ${compact ? "compact" : ""}`}>
      <div className="preference-control">
        <span>{t("theme")}</span>
        <div className="segmented-control" role="group" aria-label={t("theme")}>
          <button className={theme === "light" ? "active" : ""} onClick={() => onThemeChange("light")} type="button">
            {t("light")}
          </button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => onThemeChange("dark")} type="button">
            {t("dark")}
          </button>
        </div>
      </div>
      <div className="preference-control">
        <span>{t("language")}</span>
        <div className="segmented-control" role="group" aria-label={t("language")}>
          <button className={locale === "ko" ? "active" : ""} onClick={() => onLocaleChange("ko")} type="button">
            {t("korean")}
          </button>
          <button className={locale === "en" ? "active" : ""} onClick={() => onLocaleChange("en")} type="button">
            {t("english")}
          </button>
        </div>
      </div>
    </div>
  );
}

type UnifiedDiffLine = {
  type: DiffLineType;
  text: string;
  baseLine: number | null;
  targetLine: number | null;
};

type SplitDiffSide = {
  type: DiffLineType;
  text: string;
  line: number;
};

type SplitDiffRow = {
  left: SplitDiffSide | null;
  right: SplitDiffSide | null;
};

function buildUnifiedDiffLines(blocks: DiffBlock[]): UnifiedDiffLine[] {
  const rows: UnifiedDiffLine[] = [];
  let baseLine = 1;
  let targetLine = 1;

  for (const block of blocks) {
    for (const text of block.lines) {
      if (block.type === "unchanged") {
        rows.push({ type: block.type, text, baseLine, targetLine });
        baseLine += 1;
        targetLine += 1;
      } else if (block.type === "removed") {
        rows.push({ type: block.type, text, baseLine, targetLine: null });
        baseLine += 1;
      } else {
        rows.push({ type: block.type, text, baseLine: null, targetLine });
        targetLine += 1;
      }
    }
  }

  return rows;
}

function buildSplitDiffRows(blocks: DiffBlock[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let baseLine = 1;
  let targetLine = 1;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) continue;

    if (block.type === "unchanged") {
      for (const text of block.lines) {
        rows.push({
          left: { type: "unchanged", text, line: baseLine },
          right: { type: "unchanged", text, line: targetLine }
        });
        baseLine += 1;
        targetLine += 1;
      }
      continue;
    }

    const nextBlock = blocks[index + 1];
    if (block.type === "removed" && nextBlock?.type === "added") {
      const maxLines = Math.max(block.lines.length, nextBlock.lines.length);
      for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
        const leftText = block.lines[lineIndex];
        const rightText = nextBlock.lines[lineIndex];
        rows.push({
          left: leftText === undefined ? null : { type: "removed", text: leftText, line: baseLine++ },
          right: rightText === undefined ? null : { type: "added", text: rightText, line: targetLine++ }
        });
      }
      index += 1;
      continue;
    }

    if (block.type === "removed") {
      for (const text of block.lines) {
        rows.push({ left: { type: "removed", text, line: baseLine++ }, right: null });
      }
      continue;
    }

    for (const text of block.lines) {
      rows.push({ left: null, right: { type: "added", text, line: targetLine++ } });
    }
  }

  return rows;
}

function diffStats(blocks: DiffBlock[]): { added: number; removed: number } {
  return blocks.reduce(
    (stats, block) => {
      if (block.type === "added") {
        stats.added += block.lines.length;
      } else if (block.type === "removed") {
        stats.removed += block.lines.length;
      }
      return stats;
    },
    { added: 0, removed: 0 }
  );
}

function diffClass(type: DiffLineType): string {
  if (type === "added") return "added";
  if (type === "removed") return "removed";
  return "unchanged";
}

function diffSign(type: DiffLineType): string {
  if (type === "added") return "+";
  if (type === "removed") return "-";
  return " ";
}

function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

function projectPageHref(projectId: string, routePath: string): string {
  return `/projects/${encodeURIComponent(projectId)}/${routePath.split("/").map(encodeURIComponent).join("/")}`;
}

function revisionPageHref(projectId: string, routePath: string, versionLabel: string | null): string {
  const base = projectPageHref(projectId, routePath);
  return versionLabel ? `${base}?revision=${encodeURIComponent(versionLabel)}` : base;
}

function parseAppRoute(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/") return { type: "dashboard" };
  if (normalized === "/projects") return { type: "projects" };
  if (normalized === "/settings") return { type: "settings" };

  const projectMatch = normalized.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    try {
      return { type: "project", projectId: decodeURIComponent(projectMatch[1] ?? "") };
    } catch {
      return { type: "dashboard" };
    }
  }

  return { type: "dashboard" };
}

function shareUrlForPath(path: string, networkInfo: NetworkInfo | null): string {
  const origin = preferredShareOrigin(networkInfo);
  return new URL(path, origin).toString();
}

function preferredShareOrigin(networkInfo: NetworkInfo | null): string {
  const lanUrl = networkInfo?.urls.find((entry) => entry.kind === "lan")?.url;
  if (lanUrl) {
    return lanUrl;
  }
  const currentUrl = networkInfo?.urls.find((entry) => entry.kind === "current")?.url;
  if (currentUrl) {
    return currentUrl;
  }
  return window.location.origin;
}

function networkLabel(entry: NetworkUrl, t: Translate): string {
  if (entry.kind === "current") return t("currentBrowserUrl");
  return entry.label;
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function initialLocale(): Locale {
  const stored = readPreference("marklog.locale");
  if (stored === "ko" || stored === "en") {
    return stored;
  }
  return navigator.languages.some((language) => language.toLowerCase().startsWith("ko")) ? "ko" : "en";
}

function initialTheme(): ThemeMode {
  const stored = readPreference("marklog.theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference persistence is optional; the in-memory state still applies.
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
