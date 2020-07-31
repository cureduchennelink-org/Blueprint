exports.errorWrapper = async (fn) => {
  let res
  try {
    res = await fn()
  } catch (e) {
    return { error: e }
  }

  return res
}
