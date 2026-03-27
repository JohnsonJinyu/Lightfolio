import type { AssetRecord } from '@lightfolio/shared';

import { folderFromPath, folderLabel, formatDateTime } from '../utils/library';

interface DeleteConfirmModalProps {
  asset: AssetRecord;
  onClose: () => void;
  onRemoveFromAlbum: () => void;
  onConfirmDelete: () => void;
}

export function DeleteConfirmModal({ asset, onClose, onRemoveFromAlbum, onConfirmDelete }: DeleteConfirmModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <span className="modal-eyebrow">危险操作确认</span>
        <h3>将 {asset.fileName} 移动到系统回收站？</h3>
        <p>这个操作会影响磁盘中的原始文件。若只是不想在 Lightfolio 中显示它，建议改用“从相册移除”。</p>
        <div className="modal-meta">
          <span>当前目录：{folderLabel(folderFromPath(asset.filePath))}</span>
          <span>拍摄时间：{formatDateTime(asset.capturedAt)}</span>
        </div>
        <div className="modal-actions">
          <button className="button button-ghost" onClick={onClose}>取消</button>
          <button className="button button-secondary" onClick={onRemoveFromAlbum}>改为仅从相册移除</button>
          <button className="button button-danger" onClick={onConfirmDelete}>确认删除</button>
        </div>
      </div>
    </div>
  );
}