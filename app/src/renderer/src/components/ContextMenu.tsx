import type { AssetRecord } from '@lightfolio/shared';

interface ContextMenuProps {
  asset: AssetRecord;
  x: number;
  y: number;
  onReveal: () => void;
  onRemoveFromAlbum: () => void;
  onDeleteFromDisk: () => void;
}

export function ContextMenu({ asset, x, y, onReveal, onRemoveFromAlbum, onDeleteFromDisk }: ContextMenuProps) {
  return (
    <div className="context-menu" style={{ left: x, top: y }}>
      <div className="context-menu-title">{asset.caption?.title ?? asset.fileName}</div>
      <button className="context-item" onClick={onReveal}>在资源管理器中打开</button>
      <button className="context-item" onClick={onRemoveFromAlbum}>从相册移除</button>
      <button className="context-item context-item-danger" onClick={onDeleteFromDisk}>删除磁盘文件（回收站）</button>
    </div>
  );
}