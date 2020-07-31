exports.errorWrapper = async (fn) => {
  let res
  try {
    res = await res(fn)
  } catch (e) {
    return { error: e }
  }

  return res
}
