"""Selenium page objects for the TNC web application.

Page objects expose business-flavoured methods (login, open_radio_panel),
hide the locator strings, and use explicit waits — never time.sleep.
"""
from web.base import BasePage, WebError
from web.tnc_pages import DashboardPage, LoginPage, RadioControlPage

__all__ = ["BasePage", "WebError", "DashboardPage", "LoginPage", "RadioControlPage"]
