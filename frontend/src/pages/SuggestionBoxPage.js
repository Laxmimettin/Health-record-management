import DashboardShell from "../components/DashboardShell";
import SuggestionBoxPanel from "../components/SuggestionBoxPanel";

export default function SuggestionBoxPage({ user, theme, onToggleTheme, onLogout }) {
  return (
    <DashboardShell
      title="Suggestion Box"
      subtitle="Send and receive messages with your doctor or patient within the active access window."
      user={user} theme={theme} onToggleTheme={onToggleTheme} onLogout={onLogout}
    >
      <SuggestionBoxPanel
        user={user}
        subtitle="Type or speak inside the active access window. Patients can use English, Kannada, or Hindi, and doctors reply in English."
      />
    </DashboardShell>
  );
}
