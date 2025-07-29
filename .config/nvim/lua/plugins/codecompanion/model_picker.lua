return function(chat)
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

  local items = {}
  for _, model_entry in ipairs(models) do
    local space_idx = string.find(model_entry, " ")
    local model_name = string.sub(model_entry, 1, space_idx - 1)
    local expense = string.sub(model_entry, space_idx + 1)
    table.insert(items, {
      text = model_name,
      name = model_name,
      expense = expense,
      display_name = model_entry
    })
  end

  Snacks.picker.pick({
    title = "Select a Bro ",
    items = items,
    format = function(item, ctx)
      local model_highlight = item.name == current_model and "DiagnosticHint" or "None"
      local padded_name = string.format("%-30s", item.name)

      return {
        { padded_name, model_highlight },
        { ' ' .. item.expense, "DiagnosticInfo" }
      }
    end,
    layout = {
      preview = false,
      layout = {
        min_width = 50,
        width = 50,
        height = 20,
      }
    },
    confirm = function(picker, item)
      if item then
        chat:apply_model(item.name)
        require("codecompanion.utils").fire("ChatModel", {
          bufnr = chat.bufnr,
          model = item.name
        })
      else
        print("No model selected")
      end
    end,
  })
end
