import { lazy, Suspense, useEffect } from "react";
import { useAssetLibraryDialog } from "./asset-library-store";

const LibraryDialog = lazy(() =>
  import("./library-dialog").then((module) => ({ default: module.LibraryDialog })),
);

/** 挂载全局素材库弹窗：只在打开时加载弹窗代码，关闭后把焦点还给仍在页面上的入口。 */
export function AssetLibraryHost() {
  const isOpen = useAssetLibraryDialog((state) => state.isOpen);
  const initialTab = useAssetLibraryDialog((state) => state.initialTab);
  const opener = useAssetLibraryDialog((state) => state.opener);
  const close = useAssetLibraryDialog((state) => state.close);
  // 抽屉和菜单会卸载自己的按钮，这里只在入口还在页面上时才把焦点还回去。
  useEffect(() => {
    if (isOpen || !opener?.isConnected) return;
    opener.focus({ preventScroll: true });
  }, [isOpen, opener]);
  if (!isOpen) return null;
  return (
    <Suspense fallback={null}>
      <LibraryDialog key={initialTab} initialTab={initialTab} onClose={close} />
    </Suspense>
  );
}
