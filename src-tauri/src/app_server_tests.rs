use super::*;

#[test]
fn recognizes_only_the_initialized_notification() {
    assert!(is_initialized_notification(
        r#"{"method":"initialized","params":{}}"#
    ));
    assert!(!is_initialized_notification(
        r#"{"id":"client:1","method":"initialize"}"#
    ));
    assert!(!is_initialized_notification("not json"));
}
