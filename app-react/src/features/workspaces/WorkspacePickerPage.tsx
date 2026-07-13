import { Link } from "react-router-dom";
import { Card } from "@/components/Card/Card";
import { buildWorkspacePath } from "@/features/workspaces/routing";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export default function WorkspacePickerPage() {
  const memberships = useWorkspaceStore((state) => state.memberships);

  return (
    <section className="grid gap-4">
      <Card as="section" className="space-y-2">
        <div className="stellar-eyebrow">Workspace picker</div>
        <h2 className="m-0 text-2xl font-semibold text-stellar-text-strong">Choose a workspace</h2>
        <p className="m-0 text-sm text-stellar-muted">
          The React beta only renders a workspace after the URL slug is matched against a real
          accessible membership.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {memberships.map((membership) => (
          <Card key={membership.workspaceId} as="section" tone="raised" className="space-y-4">
            <div className="space-y-1">
              <div className="stellar-eyebrow">{membership.role}</div>
              <h3 className="m-0 text-xl font-semibold text-stellar-text-strong">{membership.name}</h3>
              <p className="m-0 text-sm text-stellar-muted">/{membership.slug}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-stellar-muted">
              <span>Sheets {membership.features.sheetsEnabled ? "enabled" : "off"}</span>
              <span>Monday {membership.features.mondayEnabled ? "enabled" : "off"}</span>
            </div>
            <Link className="stellar-nav-link inline-flex w-fit px-4 py-2" to={buildWorkspacePath(membership.slug)}>
              Open calendar
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}
