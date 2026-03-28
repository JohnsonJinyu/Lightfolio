interface ShortcutHelpModalProps {
  onClose: () => void;
}

export function ShortcutHelpModal({ onClose }: ShortcutHelpModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-shortcuts" onClick={(event) => event.stopPropagation()}>
        <span className="modal-eyebrow">快捷键帮助</span>
        <h3>浏览</h3>
        <div className="shortcut-list">
          <div><kbd>←</kbd><span>上一张</span></div>
          <div><kbd>→</kbd><span>下一张</span></div>
          <div><kbd>F</kbd><span>切换主图全屏</span></div>
          <div><kbd>F11</kbd><span>切换主图全屏</span></div>
          <div><kbd>?</kbd><span>打开或关闭帮助</span></div>
          <div><kbd>Esc</kbd><span>关闭菜单或对话框</span></div>
        </div>
        <div className="modal-actions">
          <button className="button button-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
}