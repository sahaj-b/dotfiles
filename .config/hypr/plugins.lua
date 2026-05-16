hl.config({
  plugin = {
    ["dynamic-cursors"] = {
      enabled = true,
      mode = "stretch",
      threshold = 2,
      rotate = {
        length = 20,
        offset = 0.0,
      },
      tilt = {
        limit = 3500,
        ["function"] = "negative_quadratic",
      },
      stretch = {
        limit = 3000,
        ["function"] = "quadratic",
      },
      shake = {
        enabled = true,
        nearest = true,
        threshold = 5.0,
        base = 1.5,
        speed = 0.5,
        influence = 5.0,
        limit = 0.0,
        timeout = 0,
        effects = false,
      },
    },
  },
})

