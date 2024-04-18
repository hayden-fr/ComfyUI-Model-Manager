import yaml
from dataclasses import dataclass

@dataclass
class Rule:
    key: any
    value_default: any
    value_type: type
    value_min: any # int | float | None
    value_max: any # int | float | None

    def __init__(
            self, 
            key, 
            value_default, 
            value_type: type, 
            value_min: any = None, # int | float | None
            value_max: any = None, # int | float | None
    ):
        self.key = key
        self.value_default = value_default
        self.value_type = value_type
        self.value_min = value_min
        self.value_max = value_max

def _get_valid_value(data: dict, r: Rule):
    if r.value_type != type(r.value_default):
        raise Exception(f"'value_type' does not match type of 'value_default'!")
    value = data.get(r.key)
    if value is None:
        value = r.value_default
    else:
        try:
            value = r.value_type(value)
        except:
            value = r.value_default

    value_is_numeric = r.value_type == int or r.value_type == float
    if value_is_numeric and r.value_min:
        if r.value_type != type(r.value_min):
            raise Exception(f"Type of 'value_type' does not match the type of 'value_min'!")
        value = max(r.value_min, value)
    if value_is_numeric and r.value_max:
        if r.value_type != type(r.value_max):
            raise Exception(f"Type of 'value_type' does not match the type of 'value_max'!")
        value = min(r.value_max, value)

    return value

def validated(rules: list[Rule], data: dict = {}):
    valid = {}
    for r in rules:
        valid[r.key] = _get_valid_value(data, r)
    return valid

def yaml_load(path, rules: list[Rule]):
    data = {}
    try:
        with open(path, 'r') as file:
            data = yaml.safe_load(file)
    except:
        pass
    return validated(rules, data)

def yaml_save(path, rules: list[Rule], data: dict) -> bool:
    data = validated(rules, data)
    try:
        with open(path, 'w') as file:
            yaml.dump(data, file)
        return True
    except:
        return False
