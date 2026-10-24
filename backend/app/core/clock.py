"""Today's date as a dependency, so tests can pin it for recurring generation."""

import datetime as dt


def get_today() -> dt.date:
    return dt.date.today()
