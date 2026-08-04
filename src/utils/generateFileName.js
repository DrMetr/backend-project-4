import path from "node:path";

export default (link, extension = path.extname(link).slice(1)) => {
  let newLink = link
    .split(/[^a-zA-Z0-9]+/gi)
    .filter((piece) => {
      console.log(piece);
      return piece !== "http" && piece !== "https" && piece !== "";
    })
    .join("-");
  if (newLink.endsWith(extension)) newLink = newLink.replace(/-[^-]*$/, "");
  return (
    newLink +
    `${extension === "_files" || extension === "" ? "" : "."}${extension || ""}`
  );
};
