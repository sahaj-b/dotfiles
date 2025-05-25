return function(chat)
  local pickers = require("telescope.pickers")
  local finders = require("telescope.finders")
  local actions = require("telescope.actions")
  local action_state = require("telescope.actions.state")
  local conf = require("telescope.config").values
  local current_model = chat.adapter.schema.model.default
  local models = {
    "claude-sonnet-4",
    "gemini-2.5-pro",
    "claude-3.5-sonnet",
    "gpt-4o",
    "gemini-2.0-flash-001",
    "claude-3.7-sonnet",
    "o4-mini",
    "claude-3.7-sonnet-thought",
    "o1",
    "o3-mini",
  }
  local marker = "⭐ "
  for i, model_name in ipairs(models) do
    if model_name == current_model then
      models[i] = marker .. model_name
      break
    end
  end
  pickers.new({}, {
    prompt_title = "Select a Bro",
    finder = finders.new_table {
      results = models
    },
    sorter = conf.generic_sorter({}),
    layout_config = {
      height = 20,
      width = 50,
    },
    attach_mappings = function(prompt_bufnr, _)
      actions.select_default:replace(function()
        actions.close(prompt_bufnr)

        local selection_entry = action_state.get_selected_entry()

        if selection_entry and selection_entry.value then
          local selected_model_name = selection_entry.value

          if string.sub(selected_model_name, 1, 2) == marker then
            selected_model_name = string.sub(selected_model_name, 3)
          end

          chat:apply_model(selected_model_name)
          require("codecompanion.utils").fire("ChatModel", {
            bufnr = chat.bufnr,
            model = selected_model_name
          })
        else
          print("No model selected")
        end
      end)
      return true
    end,
  }):find()
end
