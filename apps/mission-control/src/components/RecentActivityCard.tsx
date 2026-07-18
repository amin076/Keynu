const activities = [
  {
    id: "workspace-layout",
    title: "Workspace layout created",
    detail: "Main workspace and operational sidebar were connected.",
    status: "Completed"
  },
  {
    id: "system-status",
    title: "System status card added",
    detail: "Runtime, browser, mission, driver and queue states are visible.",
    status: "Verified"
  },
  {
    id: "navigation-state",
    title: "Navigation state recovered",
    detail: "Responsive section navigation and shared dashboard state are active.",
    status: "Verified"
  }
];

export function RecentActivityCard() {
  return (
    <article className="panel recent-activity-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">RECENT ACTIVITY</p>
          <h2>Mission timeline</h2>
        </div>
      </div>

      <ol className="activity-list">
        {activities.map((activity) => (
          <li className="activity-item" key={activity.id}>
            <span className="activity-marker" aria-hidden="true" />
            <div className="activity-content">
              <div className="activity-title-row">
                <strong>{activity.title}</strong>
                <span className="activity-status">{activity.status}</span>
              </div>
              <p>{activity.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
