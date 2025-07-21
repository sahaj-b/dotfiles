return function(chat)
  local pickers = require("telescope.pickers")
  local finders = require("telescope.finders")
  local actions = require("telescope.actions")
  local action_state = require("telescope.actions.state")
  local conf = require("telescope.config").values
  local entry_display = require("telescope.pickers.entry_display")
  local current_model = chat.adapter.schema.model.default

  local models = {
    "gpt-4.1 0",
    "o4-mini 0.33",
    "claude-sonnet-4 1",
    "gpt-4o 0",
    "gemini-2.5-pro 1",
    "claude-3.5-sonnet 1",
    "claude-3.7-sonnet 1",
    "gemini-2.0-flash-001 0.25",
    "claude-3.7-sonnet-thought 1.25",
    "o3-mini 0.33",
    "o3 1",
    "o1 10",
  }

  -- Parse models into name and expense
  local parsed_models = {}
  for _, model_entry in ipairs(models) do
    local space_idx = string.find(model_entry, " ")
    local model_name = string.sub(model_entry, 1, space_idx - 1)
    local expense = string.sub(model_entry, space_idx + 1)
    table.insert(parsed_models, {
      name = model_name,
      expense = expense,
      display_name = model_entry
    })
  end

  local displayer = entry_display.create({
    separator = " ",
    items = {
      { width = 27 },
      { remaining = true },
    },
  })

  local curr_highlight = "DiagnosticHint"
  local make_display = function(entry)
    local model_name = entry.name
    local expense_text = " " .. entry.expense
    local model_highlight = "None"

    if entry.name == current_model then
      model_highlight = curr_highlight
    end

    return displayer({
      { model_name,   model_highlight },
      { expense_text, "DiagnosticInfo" }
    })
  end

  local entry_maker = function(model_data)
    return {
      value = model_data.name,
      display = make_display,
      ordinal = model_data.name,
      name = model_data.name,
      expense = model_data.expense,
    }
  end

  pickers.new({}, {
    prompt_title = "Select a Bro",
    finder = finders.new_table {
      results = parsed_models,
      entry_maker = entry_maker,
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
