import { useState } from 'react';
import EeraOrb from './EeraOrb.jsx';
import EeraPanel from './EeraPanel.jsx';

function EeraWidget() {
  const [isOpen, setIsOpen] = useState(false);

  function togglePanel() {
    setIsOpen((open) => !open);
  }

  return (
    <div className="eera-widget">
      <EeraPanel isOpen={isOpen} />
      <EeraOrb isOpen={isOpen} onClick={togglePanel} />
    </div>
  );
}

export default EeraWidget;
