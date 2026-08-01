import { ExternalLink, LogIn, LogOut, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import type { AccountController } from "../lib/useAccount";
import { IconCard } from "./IconCard";
import { CardStack } from "./CardStack";
import { RoundIconButton } from "./RoundIcon";
import { Alert } from "./Alert";

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
    <CardStack className="account-auth-actions">
      <IconCard
        title={t("account.auth.title")}
        subtitle={
          <>
          {controller.authPending
            ? controller.authOpenMode === "system"
              ? t("account.auth.pendingSystem")
              : t("account.auth.pending")
            : account
              ? t("account.auth.connected")
              : t("account.auth.disconnected")}
          </>
        }
        trailing={controller.authPending ? (
          <div className="account-auth-buttons">
            <RoundIconButton icon={ExternalLink} label={t("account.auth.reopen")} onClick={() => void controller.reopenLogin()} size="medium" variant="secondary" />
            <RoundIconButton icon={X} label={t("common.cancel")} onClick={() => void controller.cancelLogin()} size="medium" variant="secondary" />
          </div>
        ) : !account ? (
          <RoundIconButton
            disabled={controller.startingLogin}
            icon={LogIn}
            label={controller.startingLogin
              ? t("account.auth.opening")
              : t("account.auth.login")}
            onClick={() => void controller.startLogin()}
            size="medium"
            variant="secondary"
          />
        ) : confirmingLogout ? (
          <div
            className="account-logout-confirm"
            role="group"
            aria-label={t("common.confirm")}
          >
            <span>{t("account.auth.logoutQuestion")}</span>
            <RoundIconButton label={t("common.cancel")} onClick={() => setConfirmingLogout(false)} size="medium" variant="secondary" />
            <RoundIconButton
              className="danger"
              disabled={controller.loggingOut}
              label={t("account.auth.logoutConfirm")}
              onClick={() => {
                setConfirmingLogout(false);
                void controller.logout();
              }}
              size="medium"
              variant="secondary"
            />
          </div>
        ) : canLogout ? (
          <RoundIconButton icon={LogOut} label={t("account.auth.logout")} onClick={() => setConfirmingLogout(true)} size="medium" variant="secondary" />
        ) : (
          <small className="account-auth-external">
            {t("account.auth.external")}
          </small>
        )}
      >
        {controller.authError && (
          <Alert tone="error">
            {controller.authError}
          </Alert>
        )}
      </IconCard>
    </CardStack>
  );
}
