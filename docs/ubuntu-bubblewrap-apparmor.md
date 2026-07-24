# Sandbox Codex avec Bubblewrap sur Ubuntu 24.04+

## Symptôme

Codex affiche :

> Codex's Linux sandbox uses bubblewrap and needs access to create user namespaces.

Ubuntu 24.04 active par défaut la médiation AppArmor des espaces de noms utilisateur. Le réglage suivant peut donc valoir `1` même si `kernel.unprivileged_userns_clone` vaut également `1` :

```bash
sysctl kernel.apparmor_restrict_unprivileged_userns
```

Codex vérifie Bubblewrap avec :

```bash
bwrap --unshare-user --unshare-net --ro-bind / / /bin/true
```

Sans profil adapté, Ubuntu refuse ce probe, souvent avec `Failed RTM_NEWADDR: Operation not permitted`.

## Solution recommandée pour Codex Desktop

Ne désactivez pas globalement `kernel.apparmor_restrict_unprivileged_userns`. Installez plutôt le profil ciblé fourni avec l'application :

```bash
cd /home/baptiste/dev/codex/codex-desktop-linux
sudo install -m 0644 packaging/apparmor/codex-desktop-linux \
  /etc/apparmor.d/codex-desktop-linux
sudo apparmor_parser -r /etc/apparmor.d/codex-desktop-linux
```

Le profil ne s'attache qu'à `/usr/bin/codex-desktop-linux`, qui est installé et détenu par root. Le processus app-server et Bubblewrap héritent de ce profil. Il accorde uniquement la permission AppArmor `userns` et laisse la restriction globale activée pour les autres programmes.

Fermez complètement l'ancienne instance depuis le tray, puis relancez l'application afin qu'elle démarre sous le profil.

## Vérification

La restriction globale doit rester active :

```bash
cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns
# 1
```

Le probe direct, non profilé, peut continuer à échouer. Le probe sous le profil Codex Desktop doit réussir :

```bash
aa-exec -p codex-desktop-linux -- \
  bwrap --unshare-user --unshare-net --ro-bind / / /bin/true
echo $?
# 0
```

Vérifiez aussi que le profil est chargé :

```bash
sudo aa-status | grep codex-desktop-linux
```

## Retour arrière

```bash
sudo apparmor_parser -R /etc/apparmor.d/codex-desktop-linux
sudo rm /etc/apparmor.d/codex-desktop-linux
```

La restriction globale Ubuntu n'est jamais modifiée par cette procédure.

## Portée et sécurité

- Cette règle concerne l'application Debian `/usr/bin/codex-desktop-linux`.
- Elle ne couvre pas automatiquement un lancement direct du CLI Codex installé sous NVM.
- Profiler globalement `/usr/bin/bwrap` est déconseillé : cela autoriserait tous ses appelants à créer des user namespaces.
- Désactiver le sysctl globalement augmente davantage la surface d'attaque du noyau et n'est pas nécessaire ici.

## Références

- [Ubuntu : restriction AppArmor des user namespaces](https://discourse.ubuntu.com/t/spec-unprivileged-user-namespace-restrictions-via-apparmor-in-ubuntu-23-10/37626)
- [Ubuntu AppArmor profile syntax, règles `userns`](https://manpages.ubuntu.com/manpages/plucky/en/man5/apparmor.d.5.html)
- [Ubuntu security features](https://documentation.ubuntu.com/security/security-features/security-features-overview/)
- [AppArmor wiki : unprivileged user namespace restriction](https://gitlab.com/apparmor/apparmor/-/wikis/unprivileged_userns_restriction)
- Implémentation du probe Codex : `codex-rs/sandboxing/src/bwrap.rs` dans ce dépôt.
