import { IconListCheck } from "@tabler/icons-react";
export function TasksPage() {
  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">生成记录</p>
          <h1>任务中心</h1>
          <p>查看任务进度，找回每一次创作。</p>
        </div>
      </div>
      <div className="surface empty-state">
        <IconListCheck size={32} aria-hidden="true" />
        <h2>任务服务尚未接入</h2>
        <p>当前版本不会提交或保存生成任务。</p>
      </div>
    </section>
  );
}
