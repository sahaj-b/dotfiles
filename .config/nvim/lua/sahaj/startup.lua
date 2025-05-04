-- Shamelessly stolen from minintro (https://github.com/eoh-bse/minintro.nvim)
-- doesn't work when input is piped

if vim.fn.argc() > 0 then return end
local intro_logo = {
  "                    .           ",
  "                  ...           ",
  "                .....           ",
  "              .......           ",
  "            .........           ",
  "          .........             ",
  "        ........                ",
  "     ..........                 ",
  "   .............     ....       ",
  " ..........................     ",
  "..............................  ",
  "   .............................",
  "     ........................   ",
  "       ...     ............     ",
  "                .........       ",
  "              ........          ",
  "          ..........            ",
  "          ........              ",
  "          ......                ",
  "          ....                  ",
  "          ..                    ",
}

local INTRO_LOGO_HEIGHT = #intro_logo
local INTRO_LOGO_WIDTH = 35
local highlight_ns_id = vim.api.nvim_create_namespace("start")

local function draw_intro(buf, logo_width, logo_height)
  local window = vim.fn.bufwinid(buf)
  local screen_width = vim.api.nvim_win_get_width(window)
  local screen_height = vim.api.nvim_win_get_height(window) - vim.opt.cmdheight:get()

  local start_col = math.floor((screen_width - logo_width) / 2)
  local start_row = math.floor((screen_height - logo_height) / 2)
  if start_col < 0 or start_row < 0 then return end

  local top_space = {}
  for _ = 1, start_row do table.insert(top_space, "") end

  local col_offset_spaces = {}
  for _ = 1, start_col do table.insert(col_offset_spaces, " ") end
  local col_offset = table.concat(col_offset_spaces, "")

  local adjusted_logo = {}
  for _, line in ipairs(intro_logo) do
    table.insert(adjusted_logo, col_offset .. line)
  end

  vim.api.nvim_buf_set_lines(buf, 1, 1, true, top_space)
  vim.api.nvim_buf_set_lines(buf, start_row, start_row, true, adjusted_logo)

  vim.api.nvim_buf_set_extmark(buf, highlight_ns_id, start_row, start_col, {
    end_row = start_row + INTRO_LOGO_HEIGHT,
    hl_group = "Directory"
  })
end

local function create_intro_buffer()
  local intro_buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_name(intro_buf, "start")
  vim.api.nvim_set_option_value("buftype", "nofile", { buf = intro_buf })
  -- vim.api.nvim_set_option_value("bufhidden", "wipe", { buf = intro_buf })
  -- vim.api.nvim_set_option_value("filetype", "start", { buf = intro_buf })
  -- vim.api.nvim_set_option_value("swapfile", false, { buf = intro_buf })

  return intro_buf
end

vim.api.nvim_create_autocmd("VimEnter", {
  callback = function()
    local buf = create_intro_buffer()
    vim.api.nvim_set_current_buf(buf)

    vim.opt_local.number = false
    vim.opt_local.relativenumber = false
    -- vim.opt_local.list = false
    -- vim.opt_local.fillchars = { eob = " " }
    vim.opt_local.colorcolumn = "0"

    draw_intro(buf, INTRO_LOGO_WIDTH, INTRO_LOGO_HEIGHT)
  end,
  once = true
})
