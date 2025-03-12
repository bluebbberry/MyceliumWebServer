# spore_action.py
# Possible types:
# - JOIN_GROUP
# - ACCEPT_JOIN

class SporeAction:
  def __init__(self, spore_type, args, actor):
    self.spore_type = spore_type
    self.args = args
    self.actor = actor
