import { createRoot } from 'react-dom/client';
import EeraWidget from '../components/EeraWidget.jsx';
import widgetStyles from '../components/eera-widget.css?inline';

const hostId = 'eera-assistant-host';

function mountEera() {
  if (document.getElementById(hostId)) return;

  const mountPoint = document.body ?? document.documentElement;
  if (!mountPoint) {
    throw new Error('Eera could not find a document element to mount into.');
  }

  const host = document.createElement('div');
  host.id = hostId;
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = widgetStyles;
  shadowRoot.append(style);

  const appRoot = document.createElement('div');
  shadowRoot.append(appRoot);
  mountPoint.append(host);

  createRoot(appRoot).render(<EeraWidget />);
}

if (document.body || document.documentElement) {
  mountEera();
} else {
  document.addEventListener('DOMContentLoaded', mountEera, { once: true });
}
