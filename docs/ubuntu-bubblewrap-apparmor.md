# Codex Bubblewrap sandbox on Ubuntu 24.04+

## Symptom

Codex displays:

> Codex's Linux sandbox uses bubblewrap and needs access to create user namespaces.

Ubuntu 24.04 enables AppArmor mediation of unprivileged user namespaces by
default. The following setting may therefore be `1` even when
`kernel.unprivileged_userns_clone` is also `1`:

```bash
sysctl kernel.apparmor_restrict_unprivileged_userns
```

Codex probes Bubblewrap with:

```bash
bwrap --unshare-user --unshare-net --ro-bind / / /bin/true
```

Without a suitable profile, Ubuntu rejects this probe, often with
`Failed RTM_NEWADDR: Operation not permitted`.

## Recommended solution for Codex Desktop

Do not disable `kernel.apparmor_restrict_unprivileged_userns` globally. Instead,
from the repository root, install the narrowly scoped profile provided with the
application:

```bash
sudo install -m 0644 packaging/apparmor/codex-desktop-linux \
  /etc/apparmor.d/codex-desktop-linux
sudo apparmor_parser -r /etc/apparmor.d/codex-desktop-linux
```

The profile attaches only to `/usr/bin/codex-desktop-linux`, which is installed
and owned by root. The App Server process and Bubblewrap inherit this profile.
It grants only the AppArmor `userns` permission and keeps the global restriction
enabled for every other program.

Quit the existing instance completely from the tray, then restart the
application so it launches under the profile.

## Verification

The global restriction must remain enabled:

```bash
cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns
# 1
```

The direct, unconfined probe may still fail. The probe under the Codex Desktop
profile must succeed:

```bash
aa-exec -p codex-desktop-linux -- \
  bwrap --unshare-user --unshare-net --ro-bind / / /bin/true
echo $?
# 0
```

Also verify that the profile is loaded:

```bash
sudo aa-status | grep codex-desktop-linux
```

## Rollback

```bash
sudo apparmor_parser -R /etc/apparmor.d/codex-desktop-linux
sudo rm /etc/apparmor.d/codex-desktop-linux
```

This procedure never changes Ubuntu's global restriction.

## Scope and security

- This rule applies to the Debian application at
  `/usr/bin/codex-desktop-linux`.
- It does not automatically cover direct use of a Codex CLI installed through
  NVM.
- Applying a profile globally to `/usr/bin/bwrap` is discouraged because it
  would allow every caller to create user namespaces.
- Disabling the sysctl globally increases the kernel attack surface and is not
  necessary here.

## References

- [Ubuntu: AppArmor restrictions for unprivileged user namespaces](https://discourse.ubuntu.com/t/spec-unprivileged-user-namespace-restrictions-via-apparmor-in-ubuntu-23-10/37626)
- [Ubuntu AppArmor profile syntax and `userns` rules](https://manpages.ubuntu.com/manpages/plucky/en/man5/apparmor.d.5.html)
- [Ubuntu security features](https://documentation.ubuntu.com/security/security-features/security-features-overview/)
- [AppArmor wiki: unprivileged user namespace restriction](https://gitlab.com/apparmor/apparmor/-/wikis/unprivileged_userns_restriction)
- Codex probe implementation: `codex-rs/sandboxing/src/bwrap.rs` in the Codex
  repository.
