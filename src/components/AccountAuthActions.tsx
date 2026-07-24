import { ExternalLink, LogIn, LogOut, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AccountController } from "../lib/useAccount";

export function AccountAuthActions({
  controller,
}: {
  controller: AccountController;
}) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const { t } = useI18n();
  const account = controller.account?.account;
  const canLogout =
    account?.type === "chatgpt" ||
    account?.type === "apiKey" ||
    (account?.type === "amazonBedrock" && account.usesCodexManagedCredentials);

  return (
    <section className="settings-card account-auth-actions">
      <div>
        <strong>{t("account.auth.title")}</strong>
        <small>
          {controller.authPending
            ? controller.authOpenMode === "system"
              ? t("account.auth.pendingSystem")
              : t("account.auth.pending")
            : account
              ? t("account.auth.connected")
              : t("account.auth.disconnected")}
        </small>
        {controller.authError && (
          <p className="account-auth-error" role="alert">
            {controller.authError}
          </p>
        )}
      </div>
      {controller.authPending ? (
        <div className="account-auth-buttons">
          <button onClick={() => void controller.reopenLogin()}>
            <ExternalLink /> {t("account.auth.reopen")}
          </button>
          <button onClick={() => void controller.cancelLogin()}>
            <X /> {t("common.cancel")}
          </button>
        </div>
      ) : !account ? (
        <button
          disabled={controller.startingLogin}
          onClick={() => void controller.startLogin()}
        >
          <LogIn />
          {controller.startingLogin
            ? t("account.auth.opening")
            : t("account.auth.login")}
        </button>
      ) : confirmingLogout ? (
        <div
          className="account-logout-confirm"
          role="group"
          aria-label={t("common.confirm")}
        >
          <span>{t("account.auth.logoutQuestion")}</span>
          <button onClick={() => setConfirmingLogout(false)}>
            {t("common.cancel")}
          </button>
          <button
            className="danger"
            disabled={controller.loggingOut}
            onClick={() => {
              setConfirmingLogout(false);
              void controller.logout();
            }}
          >
            {t("account.auth.logoutConfirm")}
          </button>
        </div>
      ) : canLogout ? (
        <button onClick={() => setConfirmingLogout(true)}>
          <LogOut /> {t("account.auth.logout")}
        </button>
      ) : (
        <small className="account-auth-external">
          {t("account.auth.external")}
        </small>
      )}
    </section>
  );
}
