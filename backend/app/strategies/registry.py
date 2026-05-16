from app.strategies.base import StrategyPlugin, StrategyTemplateDefinition
from app.strategies.builtin import BUILTIN_STRATEGY_DEFINITIONS, BuiltinStrategyPlugin


class StrategyRegistry:
    def __init__(self, definitions: list[StrategyTemplateDefinition]):
        self._plugins = {definition.key: BuiltinStrategyPlugin(definition) for definition in definitions}

    def get(self, key: str) -> StrategyPlugin | None:
        return self._plugins.get(key)

    def require(self, key: str) -> StrategyPlugin:
        plugin = self.get(key)
        if plugin is None:
            raise KeyError(key)
        return plugin

    def list_definitions(self) -> list[StrategyTemplateDefinition]:
        return [plugin.definition for plugin in self._plugins.values()]


strategy_registry = StrategyRegistry(BUILTIN_STRATEGY_DEFINITIONS)
