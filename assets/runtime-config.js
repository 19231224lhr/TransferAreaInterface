// Frontend runtime config.
// Normal daily use only needs to toggle `devMode` below:
// - true  => local development / local backend
// - false => server deployment / production backend

window.__PANGU_RUNTIME__ = {
  devMode: false,
  devApiBaseUrl: 'http://127.0.0.1:3001',
  prodApiBaseUrl: 'http://47.243.174.71:3001'
};

(function applyPanguRuntimeConfig() {
  const runtime = window.__PANGU_RUNTIME__ || {};

  const parseBool = (value, fallback) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  };

  const devMode = parseBool(runtime.devMode, false);
  const devApiBaseUrl = String(runtime.devApiBaseUrl || 'http://127.0.0.1:3001').trim();
  const prodApiBaseUrl = String(runtime.prodApiBaseUrl || 'http://47.243.174.71:3001').trim();

  window.__PANGU_DEV__ = devMode;
  window.__API_BASE_URL__ = devMode ? devApiBaseUrl : prodApiBaseUrl;
})();
