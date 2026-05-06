"""Moved.

Earlier the framework had a standalone `kpi` marker. The marker taxonomy
now folds KPI tests under `nfr_performance` instead. See
``test_nfr_performance.py`` for the equivalent tests.

This file is intentionally empty — pytest's collection will skip it
silently. Delete it once everyone on the team has switched to the
``-m "nfr and nfr_performance"`` invocation.
"""
