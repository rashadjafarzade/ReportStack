"""
Selenium WebDriver action hooks.

Patches a small set of WebDriver methods (click, send_keys, get, submit)
so each user-action call captures a screenshot and reports it back to
the plugin as a step. Read-only methods (find_element, find_elements,
attribute getters) are NOT patched to keep volume reasonable.
"""

from __future__ import annotations

import logging
import time

logger = logging.getLogger("automation-reports")

_PATCHED_FLAG = "_ar_action_patched"

_ELEMENT_ACTION_METHODS = ("click", "send_keys", "submit", "clear")
_DRIVER_ACTION_METHODS = ("get", "execute_script")


def patch_driver_for_action_screenshots(driver, capture_fn, report_step_fn):
    if getattr(driver, _PATCHED_FLAG, False):
        return

    for method_name in _DRIVER_ACTION_METHODS:
        original = getattr(driver, method_name, None)
        if original is None or not callable(original):
            continue
        wrapped = _wrap_method(method_name, original, capture_fn, report_step_fn,
                               describe_args=_describe_driver_args)
        try:
            setattr(driver, method_name, wrapped)
        except (AttributeError, TypeError):
            pass

    _patch_finder_methods(driver, capture_fn, report_step_fn)

    setattr(driver, _PATCHED_FLAG, True)
    logger.info("Action hooks installed on driver %s", type(driver).__name__)


def _patch_finder_methods(driver, capture_fn, report_step_fn):
    for finder_name in ("find_element", "find_elements"):
        original = getattr(driver, finder_name, None)
        if original is None:
            continue
        wrapped = _make_finder_wrapper(original, capture_fn, report_step_fn)
        try:
            setattr(driver, finder_name, wrapped)
        except (AttributeError, TypeError):
            pass


def _make_finder_wrapper(original_finder, capture_fn, report_step_fn):
    def finder_wrapper(*args, **kwargs):
        result = original_finder(*args, **kwargs)
        if isinstance(result, list):
            for el in result:
                _patch_element(el, capture_fn, report_step_fn)
        elif result is not None:
            _patch_element(result, capture_fn, report_step_fn)
        return result
    return finder_wrapper


def _patch_element(element, capture_fn, report_step_fn):
    if getattr(element, _PATCHED_FLAG, False):
        return
    for method_name in _ELEMENT_ACTION_METHODS:
        original = getattr(element, method_name, None)
        if original is None or not callable(original):
            continue
        wrapped = _wrap_method(method_name, original, capture_fn, report_step_fn,
                               describe_args=_describe_element_args, element=element)
        try:
            setattr(element, method_name, wrapped)
        except (AttributeError, TypeError):
            pass
    setattr(element, _PATCHED_FLAG, True)


def _wrap_method(method_name, original, capture_fn, report_step_fn,
                 describe_args, element=None):
    def wrapped(*args, **kwargs):
        try:
            result = original(*args, **kwargs)
        except Exception:
            try:
                description = describe_args(method_name, args, kwargs, element)
                path = capture_fn(f"action_failed_{method_name}_{int(time.time()*1000)}")
                report_step_fn(f"FAILED {description}", path)
            except Exception as inner:
                logger.debug("Failed to capture failure screenshot: %s", inner)
            raise

        try:
            description = describe_args(method_name, args, kwargs, element)
            path = capture_fn(f"action_{method_name}_{int(time.time()*1000)}")
            report_step_fn(description, path)
        except Exception as inner:
            logger.debug("Failed to capture action screenshot: %s", inner)
        return result
    return wrapped


def _describe_driver_args(method_name, args, kwargs, element):
    if method_name == "get" and args:
        return f"navigate to {args[0]}"
    if method_name == "execute_script" and args:
        snippet = str(args[0])
        if len(snippet) > 60:
            snippet = snippet[:60] + "..."
        return f"execute_script: {snippet}"
    return method_name


def _describe_element_args(method_name, args, kwargs, element):
    locator = ""
    try:
        tag = getattr(element, "tag_name", "") or ""
        if tag:
            locator = f"<{tag}>"
    except Exception:
        pass
    if method_name == "send_keys" and args:
        text = str(args[0])
        if len(text) > 30:
            text = text[:30] + "..."
        return f"send_keys {text!r} -> {locator}".strip()
    if method_name == "click":
        return f"click {locator}".strip()
    if method_name == "submit":
        return f"submit {locator}".strip()
    if method_name == "clear":
        return f"clear {locator}".strip()
    return f"{method_name} {locator}".strip()
