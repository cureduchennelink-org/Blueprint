<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <Promised :promise="chatPromise">
      <template v-slot:pending>
        <p>Loading...</p>
      </template>
      <template v-slot="data">
        <ul
          v-for="user in utilGetChatMsgs(data.RoomEvents)"
          v-bind:key="user.id"
        >
          <li>{{ user.msg }}</li>
        </ul>
      </template>
      <template v-slot:rejected="error">
        <p>Error: {{ error.message }}</p>
      </template>
    </Promised>
  </div>
</template>

<script>
import { Promised } from "vue-promised";
import { ref } from "vue"; // VUE2: '@vue/composition-api'
import { Cache } from "../Cache";
import { LongPoll } from "../LongPoll";

// curl -g 'http://localhost:9101/api/v1/RoomEvent?auth_token=eyJpaWQiOjkxLCJyb29tX2lkIjoxMDEsImlyb2xlIjpbImFkbWluIiwiRGV2Il0sInJvbGUiOiJhZG1pbiIsImV4cCI6MTYzMzMwMDM5MH0.osinkfyP90z3qTTO-ZYW55d4eAyZSuRCztUuyZuC-Wc&event=chat&JSON={"payload":{"msg":"Hey,+Dude+-+what+is+up?!"}}' -X POST

let getToken = () => ({
  token:
    //"eyJpaWQiOjkxLCJyb29tX2lkIjoxMDEsImlyb2xlIjpbImFkbWluIiwiRGV2Il0sInJvbGUiOiJhZG1pbiIsImV4cCI6MTYzMzMwMDM5MH0.osinkfyP90z3qTTO-ZYW55d4eAyZSuRCztUuyZuC-Wc",
    "eyJpaWQiOjcwMywiaXJvbGUiOiJhZG1pbixEZXYiLCJyb2xlIjoiYWRtaW4iLCJyb29tX2lkIjoyMTUsIml0ZW5hbnQiOjEwMCwiZXhwIjoxNjMzNjQ2ODAxfQ.2GwzxVKYnu8EFqR8xwDo1QoOcRS42ZtZIHQJe2ovzV4",
});
let cache = new Cache(LongPoll, "http://localhost:9101/api/v1/Poll", getToken);
let promise = cache.GetEndpoint(
  "chat",
  "http://localhost:9101/api/v1/RoomEvent"
);

const utilGetChatMsgs = (objs) => {
  console.log("utilGetChatMsgs", { objs, keys: Object.values(objs) });
  const msgs = Object.values(objs)
    .filter(($) => $.event === "chat" || true)
    .map(($) => ({
      id: $.id,
      self: false,
      msg: $.event + ": " + ($.payload.msg || $.ident_id),
    }));
  console.log("utilGetChatMsgs", { msgs });
  return msgs;
};


export default {
  name: "HelloWorld",
  props: {
    msg: String,
  },
  components: {
    Promised,
  },
  setup() {
    const chatPromise = ref(promise)

    return {
      chatPromise,
      utilGetChatMsgs,
    };
  },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
