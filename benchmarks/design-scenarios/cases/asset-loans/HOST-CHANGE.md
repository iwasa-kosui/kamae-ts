# Host additions

Add the public operation inspectReturn with JSON fields loanId, staffId,
inspectionReportId, outcome ("usable" or "repair"), and repairNotes when outcome
is "repair". Existing host operations and their behavior do not change. The host
authorizes inspection staff. The implementation still owns the record and public
result formats; describe any additions in CHANGE-NOTES.md.
