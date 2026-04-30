import os


def get_option(config, name, env_var, default=None):
    val = config.getoption(name, default=None)
    if val:
        return val
    return os.environ.get(env_var, default)


def add_options(parser):
    group = parser.getgroup("automation-reports", "Automation Reports options")
    group.addoption(
        "--ar-url",
        dest="ar_url",
        default=None,
        help="Automation Reports API base URL (e.g. http://localhost:8000/api/v1). Env: AR_URL",
    )
    group.addoption(
        "--ar-launch-name",
        dest="ar_launch_name",
        default=None,
        help="Launch name. Env: AR_LAUNCH_NAME",
    )
    group.addoption(
        "--ar-launch-description",
        dest="ar_launch_description",
        default=None,
        help="Launch description. Env: AR_LAUNCH_DESCRIPTION",
    )
    group.addoption(
        "--ar-auto-analyze",
        dest="ar_auto_analyze",
        action="store_true",
        default=False,
        help="Trigger AI analysis after test run. Env: AR_AUTO_ANALYZE",
    )
