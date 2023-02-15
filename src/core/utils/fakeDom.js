export const fakeDom = () => {
    document = self.document = { parentNode: null, nodeType: 9, toString: () => { return "FakeDocument" } };
    window = self.window = self;
    const fakeElement = Object.create(document);
    fakeElement.nodeType = 1;
    fakeElement.toString = () => { return "FakeElement" };
    fakeElement.parentNode = fakeElement.firstChild = fakeElement.lastChild = fakeElement;
    fakeElement.ownerDocument = document;

    document.innerHTML = "";
    document.head =
        document.body =
        fakeElement;
    document.ownerDocument =
        document.documentElement =
        document;

    document.createElement =
        document.getElementById =
        document.getElementsByClassName =
        document.getElementsByTagName = () => { return [fakeElement]; };

    document.appendChild = (child) => { return child; };

    document.createDocumentFragment = () => {
        this.appendChild = document.appendChild;
        return this;
    };

    document.getAttribute =
        document.removeChild =
        document.addEventListener =
        document.removeEventListener =
        document.setAttribute = () => { return null; };

    document.cloneNode = () => {
        this.cloneNode = document.cloneNode;
        this.lastChild = {
            checked: false,
        }
        return this;
    };

    document.childNodes = [];
    document.implementation = {
        createHTMLDocument: () => { return document; }
    }
}