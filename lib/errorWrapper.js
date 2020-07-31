exports.errorWrapper = async (fn) => {
  let res
  try {
    res = await fn()
  } catch (e) {
    // TODO: Add a logger
    console.log({ e })
    return { error: e }
  }

  return res
}
