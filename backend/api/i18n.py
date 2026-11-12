ERROR_MESSAGES = {
    "INVALID_JSON": "The request body contains invalid JSON.",
    "INVALID_INPUT": "Check the data you entered and try again.",
    "PROBE_NOT_FOUND": "Probe not found.",
    "OUT_OF_BOUNDS": "The command at step {step} would move the probe outside the grid.",
    "DATABASE_BUSY": "The database is busy. Try again in a moment.",
}


def error_message(code: str, **values: object) -> str:
    return ERROR_MESSAGES[code].format(**values)
