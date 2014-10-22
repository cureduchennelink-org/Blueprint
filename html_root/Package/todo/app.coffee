E.app$todo=
  SETTINGS: go: 'default/default/landing', layout: 'todo', show_issues: 'inline'
  MODELS: Todo:   class: 'Todo',    inst: 'iTodo_Todo'
  ACTIONS:
    a_clear: do: 'App.clear'
    browser_hash: {}
  MACROS:
    save_todo: do: 'Todo.save_todo', next: [
        { when: 'default', do: 'Todo.choose_item', set: {clear: true} }
      ]
  STEPS:
    landing: page: 'todo_main', ACTIONS:
      show:             pass: 'state',    do: 'Todo.show'
      new_todo:         pass: 'val',      do: 'save_todo'
      save_todo:        pass: 'val,id',   do: 'save_todo'
      delete_todo:      pass: 'id',       do: 'Todo.delete_todo'
      clear_completed:                    do: 'Todo.clear_completed'
      mark_toggle:      pass: 'id',       do: 'Todo.mark_toggle'
      mark_all:                           do: 'Todo.mark_all'
      edit_item:        pass: 'id',       do: 'Todo.choose_item'