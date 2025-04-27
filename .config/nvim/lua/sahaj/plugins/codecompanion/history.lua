--[[
CodeCompanion Chat History Management
This module provides persistence and retrieval functionality for CodeCompanion chats.
--]]

local M = {}
local path = require("plenary.path")
local context_utils = require("codecompanion.utils.context")
local client = require("codecompanion.http")
local config = require("codecompanion.config")
local default_file_path = vim.fn.stdpath("data") .. "/codecompanion_chats.json"
local chats_history_file_path = path:new(config.history and config.history.file_path or default_file_path)
local api = vim.api

-- A way to tell this chat is auto-saved
local default_buf_title = "[CodeCompanionAutoSaveChat]"

---------------------------------------------------------------------------------------------------
-- Local Helpers
---------------------------------------------------------------------------------------------------
---Use groq cloud to generate title for chat
local function generate_title(chat, callback)
  vim.notify("Generating title for chat", vim.log.levels.DEBUG)
  local default_title = default_buf_title .. " " .. chat.id
  if #chat.messages == 0 then
    return callback(default_title)
  end
  -- Get first user and llm messages
  local first_user_msg
  local first_llm_msg
  for _, msg in ipairs(chat.messages) do
    if not first_user_msg and msg.role == config.constants.USER_ROLE then
      first_user_msg = msg
    elseif not first_llm_msg and msg.role == config.constants.LLM_ROLE then
      first_llm_msg = msg
    end
    if first_user_msg and first_llm_msg then
      break
    end
  end

  if not first_user_msg then
    return callback(default_title)
  end

  -- Create prompt for title generation
  local prompt = string.format(
    "Generate a very short and concise title (max 5 words) for this chat based on the following conversation:\n\nUser: %s\n\nAssistant: %s",
    first_user_msg.content,
    --cut the content to 500 characters
    first_llm_msg and first_llm_msg.content:sub(1, 500) or ""
  )
  -- Prepare request payload
  local payload = vim.json.encode({
    messages = {
      { role = "user", content = prompt }
    },
    model = "llama-3.3-70b-versatile"
  })

  -- Make request to Groq API
  local api_key = os.getenv("GROQ_API_KEY")
  if not api_key then
    vim.notify("GROQ_API_KEY environment variable not set", vim.log.levels.ERROR)
    return callback(default_title)
  end
  client.static.opts.post.default({
    url = "https://api.groq.com/openai/v1/chat/completions",
    headers = {
      ["Authorization"] = "Bearer " .. os.getenv("GROQ_API_KEY"),
      ["Content-Type"] = "application/json"
    },
    body = payload,
    callback = function(response)
      vim.schedule(function()
        -- vim.notify(vim.inspect(response), vim.log.levels.DEBUG)
        if not response then
          return callback(default_title)
        end
        local status = response.status
        if status < 200 or status >= 300 then
          vim.notify("Failed to generate title: " .. response.body, vim.log.levels.ERROR)
          return callback(default_title)
        end
        local data = vim.json.decode(response.body)
        if not data or not data.choices or not data.choices[1] or not data.choices[1].message then
          vim.notify("Failed to generate title: Invalid response", vim.log.levels.ERROR)
          return callback(default_title)
        end

        local title = data.choices[1].message.content
        -- Clean up title by removing quotes and unnecessary whitespace
        title = title:gsub('"', ''):gsub("^%s*(.-)%s*$", "%1")
        callback(title)
      end)
    end,
    error = function(err)
      vim.schedule(function()
        vim.notify("Failed to generate title: " .. err, vim.log.levels.ERROR)
        callback(default_title)
      end)
    end
  })
end

-- Generate a simple title for the chat based on first conversation
local function create_title(chat, callback)
  -- if title is already set, ignore
  if (chat.title) then
    return;
  end
  local should_auto_generate_title = config.history and config.history.auto_generate_title or true
  if (not should_auto_generate_title) then
    callback(default_buf_title .. " " .. chat.id)
  else
    generate_title(chat, callback)
  end
end


-- Load chats directly from file without any caching to keep memory usage minimal
local function load_chats()
  if not chats_history_file_path:exists() then
    return {}
  end
  local content = chats_history_file_path:read()
  return vim.json.decode(content) or {}
end

-- Persist chat to file, filtering out system messages
local function save_chat(chat)
  local chats = load_chats()
  local key = tostring(chat.id)

  -- Filter out system messages before saving
  local messages = vim.tbl_filter(function(msg)
    return msg.role ~= "system"
  end, chat.messages)

  chats[key] = {
    title = chat.title,
    messages = messages,
  }

  chats_history_file_path:write(vim.json.encode(chats), "w")
end

-- Delete chat from storage by id
local function delete_chat(id)
  local chats = load_chats()
  chats[id] = nil
  chats_history_file_path:write(vim.json.encode(chats), "w")
end

-- Format chat data for display in telescope picker
local function format_chat_items(chats)
  local items = {}
  for id, chat in pairs(chats) do
    table.insert(items, {
      id = id,
      messages = chat.messages,
      name = chat.title,
      timestamp = tonumber(id) or 0,
    })
  end

  -- Sort by timestamp (latest first)
  table.sort(items, function(a, b)
    return a.timestamp > b.timestamp
  end)

  return items
end


-- Adapted from codecompanion ui.lua render function
-- Focuses only on message rendering without settings/visual context handling
local function render_messages(bufnr, messages, last_role, roles)
  local lines = {}

  local last_set_role
  local function spacer()
    table.insert(lines, "")
  end

  local function set_header(tbl, role)
    local header = "## " .. role
    table.insert(tbl, header)
    table.insert(tbl, "")
  end

  for i, msg in ipairs(messages) do
    -- Skip system messages or hidden messages
    if msg.role ~= config.constants.SYSTEM_ROLE or (msg.opts and msg.opts.visible ~= false) then
      if i > 1 and last_role ~= msg.role then
        spacer()
      end

      if msg.role == config.constants.USER_ROLE and last_set_role ~= config.constants.USER_ROLE then
        set_header(lines, roles.user)
      end
      if msg.role == config.constants.LLM_ROLE and last_set_role ~= config.constants.LLM_ROLE then
        set_header(lines, roles.llm)
      end

      for _, text in ipairs(vim.split(msg.content, "\n", { plain = true, trimempty = true })) do
        table.insert(lines, text)
      end

      last_set_role = msg.role
      last_role = msg.role
    end
  end

  vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
  return last_role
end
-- Format timestamp to human readable relative time
local function format_relative_time(timestamp)
  local now = os.time()
  local diff = now - timestamp

  if diff < 60 then
    return diff .. "s ago"
  elseif diff < 3600 then
    return math.floor(diff / 60) .. "m ago"
  elseif diff < 86400 then
    return math.floor(diff / 3600) .. "h ago"
  else
    return math.floor(diff / 86400) .. "d ago"
  end
end

-- Create custom previewer to show messages in markdown
local function create_previewer()
  local previewers = require("telescope.previewers")
  return previewers.new_buffer_previewer({
    title = "Chat Preview",
    define_preview = function(self, entry, status)
      render_messages(self.state.bufnr, entry.messages, nil, {
        user = "User",
        llm = "LLM",
      })
      vim.bo[self.state.bufnr].filetype = "markdown"
    end
  })
end

local function open_picker(items)
  -- Initialize telescope picker
  local pickers = require("telescope.pickers")
  local conf = require("telescope.config").values
  local finders = require("telescope.finders")
  local actions = require("telescope.actions")
  local action_state = require("telescope.actions.state")
  -- Create and open picker
  pickers.new({}, {
    prompt_title = "Saved Chats",
    finder = finders.new_table({
      results = items,
      entry_maker = function(entry)
        local current_chat = require("codecompanion").last_chat()
        local is_current = current_chat and tostring(current_chat.id) == entry.id
        local relative_time = format_relative_time(entry.timestamp)
        local display_title = string.format("%s %s (%s)",
          --some dev icon
          is_current and "🌟" or " ",
          entry.name,
          relative_time
        )

        return {
          value = entry,
          display = display_title,
          ordinal = entry.name,
          name = entry.name,
          id = entry.id,
          title = entry.name,
          messages = entry.messages,
        }
      end
    }),
    sorter = conf.generic_sorter({}),
    previewer = create_previewer(),
    attach_mappings = function(prompt_bufnr, map)
      local delete_item = function()
        local selection = action_state.get_selected_entry()
        if selection then
          delete_chat(selection.id)
          actions.close(prompt_bufnr)
          -- Reopen picker to refresh
          M.open_saved_chats()
        end
      end
      -- Add delete mapping
      map("i", "x", delete_item)
      map("n", "x", delete_item)
      actions.select_default:replace(function()
        actions.close(prompt_bufnr)
        local selection = action_state.get_selected_entry()
        if selection then
          M.create_auto_save_chat(selection.value)
        end
      end)
      return true
    end,
  }):find()
end

local function set_buf_title(bufnr, title, attempt)
  attempt = attempt or 0
  vim.schedule(function()
    --  throws error if already buffer with same name is present, so try again with different name
    local success, err = pcall(function()
      local _title = title .. " " .. (attempt > 0 and "(" .. tostring(attempt) .. ")" or "")
      vim.api.nvim_buf_set_name(bufnr, _title)
    end)
    if not success then
      if attempt > 5 then
        vim.notify("Failed to set buffer title: " .. err, vim.log.levels.ERROR)
        return
      end
      set_buf_title(bufnr, title, attempt + 1)
    end
  end)
end


---------------------------------------------------------------------------------------------------
-- Public Interface
---------------------------------------------------------------------------------------------------

-- Open the chat history picker using Telescope
M.open_saved_chats = function()
  local chats = load_chats()
  if vim.tbl_isempty(chats) then
    vim.notify("No chat history found", vim.log.levels.INFO)
    return
  end
  local items = format_chat_items(chats)
  open_picker(items)
end

-- Create a new chat with auto-saving functionality
M.create_auto_save_chat = function(chat_data)
  chat_data = chat_data or {}
  local messages = chat_data.messages or {}
  local id = chat_data.id
  local title = chat_data.name

  messages = messages or {}
  --HACK: Ensure last message is from user to show header
  if #messages > 0 and messages[#messages].role ~= "user" then
    table.insert(messages, {
      role = "user",
      content = "\n\n",
      opts = { visible = true }
    })
  end

  local context = context_utils.get(api.nvim_get_current_buf())
  local chat = require("codecompanion.strategies.chat").new({
    context = context,
    messages = messages
  })

  -- if id is available from saved chat, preserve it to avoid duplicates
  chat.id = id and tostring(id) or tostring(os.time())
  chat.title = title and title or nil   -- keep this nil if not available which will be set after generating title
  if (title) then
    set_buf_title(chat.bufnr, "✨ " .. title)
  else
    set_buf_title(chat.bufnr, "✨ " .. default_buf_title .. " " .. chat.id)
  end

  -- Add one-time subscription to generate chat title
  chat:subscribe({
    id = "chat_title_maker",
    -- FIX: in sourcecode: order doesn't work when a saved chat is loaded, which makes this subscription run atleast once whatever the order maybe
    order = 1,
    type = "once",
    callback = function(chat_instance)
      set_buf_title(chat_instance.bufnr, "✨ " .. "Deciding title...")
      create_title(chat_instance, function(generated_title)
        set_buf_title(chat_instance.bufnr, "✨ " .. generated_title)
        -- set title to be used for saving
        chat_instance.title = generated_title
        -- update title in saved chat
        save_chat(chat_instance)
      end)
    end
  })

  -- Add subscription to save chat on every response from llm
  chat:subscribe({
    id = "save_messages",
    callback = function(chat_instance)
      save_chat(chat_instance)
    end
  })

  return chat
end

-- Setup user commands for chat history management
function M.setup()
  vim.api.nvim_create_user_command("CodeCompanionHistory", function()
    M.open_saved_chats()
  end
  , {
    desc = "Open saved chats",
  })
  vim.api.nvim_create_user_command("CodeCompanionAutoSaveChat", function()
    M.create_auto_save_chat()
  end, {
    desc = "Create a new chat with auto-saving",
  })
end

return M
