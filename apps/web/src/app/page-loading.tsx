import { DataSkeleton } from "../components/data-skeleton";
import "./page-loading.css";

/** 页面与会话首次加载时使用与工作区内容接近的占位。 */
export function PageLoading() {
  return (
    <div className="page-loading-skeleton">
      <DataSkeleton layout="history" />
    </div>
  );
}
