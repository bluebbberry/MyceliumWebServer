# spore_action.py
# Possible types:
# - JOIN_GROUP
# - ACCEPT_JOIN

class SporeAction:
  def __init__(self, spore_type, args):
    self.spore_type = spore_type
    self.args = args
